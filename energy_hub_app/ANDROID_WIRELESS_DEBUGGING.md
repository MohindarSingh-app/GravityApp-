# Run EnergyHub on Android over Wi-Fi

This app now builds as a native React Native Android app. Expo Go and the Expo development server are not used.

## One-time phone setup

1. Connect the phone and computer to the same Wi-Fi network.
2. On the phone, enable **Developer options** and then **Wireless debugging**.
3. Open **Wireless debugging > Pair device with pairing code**. On the computer, run the pairing command shown by the phone:

   ```powershell
   adb pair <phone-ip>:<pairing-port>
   ```

   Enter the pairing code when ADB prompts for it.
4. Back on the Wireless debugging screen, use the separate IP address and port shown for wireless debugging:

   ```powershell
   adb connect <phone-ip>:<debug-port>
   adb devices
   ```

   The phone should appear with status `device`. Pairing is usually needed only once; reconnect with `adb connect` after the phone or computer restarts.

## Build and launch the app

From PowerShell:

```powershell
Set-Location E:\energy_hub\energy_hub_app
npm install
npm run android:wifi
```

The command starts the local backend (if it is not already running), starts Metro, forwards the required ports through ADB, builds the Android app, and installs it on the connected phone. Keep the terminal open while using the app; press **Ctrl+C** to stop the local services.

If more than one Android device is connected, select the phone explicitly:

```powershell
$env:ANDROID_SERIAL = "<phone-ip>:<debug-port>"
npm run android:wifi
```

The development API URL is configured in `.env` as `http://127.0.0.1:3000`; the runner forwards that port to the phone. For production builds, set `API_URL` to the HTTPS backend URL.
