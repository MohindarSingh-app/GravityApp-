import { describe, expect, it } from '@jest/globals';
import { resolveApiHost } from '../apiHost';

describe('resolveApiHost', () => {
  it('routes Android emulators to the host machine when Metro uses loopback', () => {
    expect(resolveApiHost('http://localhost:3000', 'android', 'http://127.0.0.1:8081/index.bundle'))
      .toBe('http://10.0.2.2:3000');
  });

  it('uses the Metro LAN address for a physical Android device', () => {
    expect(resolveApiHost('http://localhost:3000', 'android', 'http://192.168.1.4:8081/index.bundle'))
      .toBe('http://192.168.1.4:3000');
  });

  it('keeps device loopback when the Android runner configured adb reverse', () => {
    expect(resolveApiHost('http://127.0.0.1:3000', 'android', 'http://127.0.0.1:8081/index.bundle', true))
      .toBe('http://127.0.0.1:3000');
  });

  it('replaces a wildcard bind address with the Metro host for a real phone', () => {
    expect(resolveApiHost('http://0.0.0.0:3000', 'android', 'http://192.168.1.4:8081/index.bundle'))
      .toBe('http://192.168.1.4:3000');
  });

  it('keeps the Android emulator host when Metro advertises a wildcard address', () => {
    expect(resolveApiHost('http://0.0.0.0:3000', 'android', 'http://0.0.0.0:8081/index.bundle'))
      .toBe('http://10.0.2.2:3000');
  });

  it('preserves localhost for a web app running on the development machine', () => {
    expect(resolveApiHost('http://localhost:3000', 'web', 'http://192.168.1.4:8081/index.bundle'))
      .toBe('http://localhost:3000');
  });

  it('uses the backend development port when no API URL is configured', () => {
    expect(resolveApiHost(undefined, 'android', 'http://127.0.0.1:8081/index.bundle'))
      .toBe('http://10.0.2.2:3000');
  });

  it('routes an Android emulator to the host when the env file stores the PC LAN address', () => {
    expect(resolveApiHost('http://192.168.1.2:3000', 'android', 'http://127.0.0.1:8081/index.bundle'))
      .toBe('http://10.0.2.2:3000');
  });

  it('uses the Metro LAN address when a phone is given the PC LAN API URL', () => {
    expect(resolveApiHost('http://192.168.1.2:3000', 'android', 'http://192.168.1.2:8081/index.bundle'))
      .toBe('http://192.168.1.2:3000');
  });

  it('keeps the emulator on 10.0.2.2 when Metro is in LAN mode', () => {
    expect(resolveApiHost('http://192.168.1.2:3000', 'android', 'http://192.168.1.2:8081/index.bundle', false, true))
      .toBe('http://10.0.2.2:3000');
  });

  it('keeps loopback on an emulator when adb reverse is enabled', () => {
    expect(resolveApiHost('http://127.0.0.1:3000', 'android', 'http://192.168.1.2:19001/index.bundle', true, true))
      .toBe('http://127.0.0.1:3000');
  });
});
