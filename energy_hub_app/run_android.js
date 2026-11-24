const { execFile, spawn } = require('child_process');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);
const appDirectory = __dirname;
const backendDirectory = path.resolve(appDirectory, '..', 'backend');
const backendPort = Number(process.env.API_PORT || process.env.PORT || 3000);
const backendHealthUrl = `http://127.0.0.1:${backendPort}/api/health`;
const androidSdk = process.env.ANDROID_HOME
  || process.env.ANDROID_SDK_ROOT
  || path.join(os.homedir(), 'AppData', 'Local', 'Android', 'Sdk');
const adbPath = path.join(androidSdk, 'platform-tools', process.platform === 'win32' ? 'adb.exe' : 'adb');
const reactNativeCli = path.join(appDirectory, 'node_modules', 'react-native', 'cli.js');

let backendProcess;
let metroProcess;
let installProcess;
let shutdownRequested = false;

const runAdb = async (args) => {
  try {
    const { stdout, stderr } = await execFileAsync(adbPath, args, {
      timeout: 30000,
      windowsHide: true,
    });
    return `${stdout}${stderr}`.trim();
  } catch (error) {
    const details = `${error.stdout || ''}${error.stderr || ''}`.trim();
    throw new Error(details ? `${error.message}\n${details}` : error.message);
  }
};

const getDeviceSerial = async () => {
  if (!fs.existsSync(adbPath)) {
    throw new Error(`ADB was not found at ${adbPath}. Install Android platform-tools or set ANDROID_HOME.`);
  }

  const output = await runAdb(['devices', '-l']);
  const serials = output
    .split(/\r?\n/)
    .map((line) => line.match(/^(\S+)\s+device(?:\s|$)/)?.[1])
    .filter(Boolean);
  const requestedSerial = process.env.ANDROID_SERIAL;

  if (requestedSerial) {
    if (!serials.includes(requestedSerial)) {
      throw new Error(`ANDROID_SERIAL ${requestedSerial} is not connected. Connected devices: ${serials.join(', ') || 'none'}.`);
    }
    return requestedSerial;
  }

  if (serials.length === 0) {
    throw new Error(
      'No authorized Android device is connected. Pair the phone in Developer options > Wireless debugging, '
      + 'run "adb pair <phone-ip>:<pairing-port>" and then "adb connect <phone-ip>:<debug-port>".',
    );
  }
  if (serials.length > 1) {
    throw new Error(`More than one Android device is connected (${serials.join(', ')}). Set ANDROID_SERIAL to the phone serial.`);
  }
  return serials[0];
};

const isBackendReady = () => new Promise((resolve) => {
  const request = http.get(backendHealthUrl, (response) => {
    let body = '';
    response.setEncoding('utf8');
    response.on('data', (chunk) => { body += chunk; });
    response.on('end', () => {
      try {
        const health = JSON.parse(body);
        resolve(response.statusCode === 200 && health.service === 'energy_hub_backend');
      } catch {
        resolve(false);
      }
    });
  });
  request.setTimeout(1000, () => request.destroy());
  request.on('error', () => resolve(false));
});

const waitForBackend = async () => {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    if (shutdownRequested) throw new Error('Startup cancelled.');
    if (await isBackendReady()) return;
    if (backendProcess?.exitCode !== null && backendProcess?.exitCode !== undefined) {
      throw new Error(`Backend exited before becoming ready (code ${backendProcess.exitCode}).`);
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error('Backend did not become ready within 30 seconds.');
};

const startBackend = async () => {
  if (!fs.existsSync(path.join(backendDirectory, 'src', 'server.js'))) {
    throw new Error(`Backend server was not found at ${backendDirectory}.`);
  }
  if (await isBackendReady()) {
    console.log(`Using the running backend at ${backendHealthUrl}`);
    return;
  }

  console.log(`Starting the backend on port ${backendPort}...`);
  backendProcess = spawn(process.execPath, ['src/server.js'], {
    cwd: backendDirectory,
    env: { ...process.env, PORT: String(backendPort) },
    stdio: 'inherit',
  });
  backendProcess.on('error', (error) => console.error(`Could not start the backend: ${error.message}`));
  await waitForBackend();
};

const isMetroReady = () => new Promise((resolve) => {
  const request = http.get('http://127.0.0.1:8081/status', (response) => {
    let body = '';
    response.setEncoding('utf8');
    response.on('data', (chunk) => { body += chunk; });
    response.on('end', () => resolve(response.statusCode === 200 && body.includes('packager-status:running')));
  });
  request.setTimeout(1000, () => request.destroy());
  request.on('error', () => resolve(false));
});

const waitForMetro = async () => {
  const deadline = Date.now() + 120000;
  while (Date.now() < deadline) {
    if (shutdownRequested) throw new Error('Startup cancelled.');
    if (await isMetroReady()) return;
    if (metroProcess?.exitCode !== null && metroProcess?.exitCode !== undefined) {
      throw new Error(`Metro exited before becoming ready (code ${metroProcess.exitCode}).`);
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error('Metro did not become ready within 2 minutes.');
};

const startMetro = async () => {
  if (await isMetroReady()) {
    console.log('Using the running Metro server on port 8081.');
    return;
  }

  console.log('Starting the React Native Metro server...');
  metroProcess = spawn(process.execPath, [reactNativeCli, 'start', '--host', '127.0.0.1', '--port', '8081'], {
    cwd: appDirectory,
    env: process.env,
    stdio: 'inherit',
  });
  metroProcess.on('error', (error) => console.error(`Could not start Metro: ${error.message}`));
  await waitForMetro();
};

const runAndroidInstall = (serial) => new Promise((resolve, reject) => {
  installProcess = spawn(process.execPath, [
    reactNativeCli,
    'run-android',
    '--deviceId',
    serial,
    '--no-packager',
  ], {
    cwd: appDirectory,
    env: process.env,
    stdio: 'inherit',
  });
  installProcess.once('error', reject);
  installProcess.once('exit', (code, signal) => {
    installProcess = null;
    if (code === 0) resolve();
    else reject(new Error(`Android build/install failed${signal ? ` (${signal})` : ` with exit code ${code}`}.`));
  });
});

const stopChildren = () => {
  shutdownRequested = true;
  for (const child of [installProcess, metroProcess, backendProcess]) {
    if (child && child.exitCode === null) child.kill();
  }
};

process.on('SIGINT', stopChildren);
process.on('SIGTERM', stopChildren);

const run = async () => {
  const serial = await getDeviceSerial();
  console.log(`Using Android device ${serial}`);
  await startBackend();

  for (const port of [8081, backendPort]) {
    await runAdb(['-s', serial, 'reverse', `tcp:${port}`, `tcp:${port}`]);
  }

  await startMetro();
  await runAndroidInstall(serial);
  console.log('App installed and launched. Keep this terminal open; press Ctrl+C to stop Metro and the local backend.');

  await new Promise((resolve) => {
    process.once('SIGINT', resolve);
    process.once('SIGTERM', resolve);
  });
};

run().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
}).finally(stopChildren);
