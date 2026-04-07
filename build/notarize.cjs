/**
 * Post-sign notarization hook for electron-builder.
 * Uses notarytool with the keychain profile we stored earlier.
 */
const { execSync } = require('child_process');
const path = require('path');

exports.default = async function notarizing(context) {
  const { electronPlatformName, appOutDir } = context;

  if (electronPlatformName !== 'darwin') return;
  if (process.env.NODE_ENV === 'development') return;

  const appName = context.packager.appInfo.productFilename;
  const appPath = path.join(appOutDir, `${appName}.app`);

  console.log(`Notarizing ${appPath}...`);

  // Create a zip for notarization
  const zipPath = path.join(appOutDir, `${appName}-notarize.zip`);
  execSync(`ditto -c -k --keepParent "${appPath}" "${zipPath}"`, { stdio: 'inherit' });

  // Submit for notarization using the keychain profile
  execSync(
    `xcrun notarytool submit "${zipPath}" --keychain-profile "KyberBot-Notarize" --wait`,
    { stdio: 'inherit', timeout: 600_000 }
  );

  // Staple the notarization ticket to the app
  execSync(`xcrun stapler staple "${appPath}"`, { stdio: 'inherit' });

  // Clean up the temp zip
  execSync(`rm -f "${zipPath}"`);

  console.log('Notarization complete.');
};
