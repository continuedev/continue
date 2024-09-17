import * as vscode from "vscode";
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const pearAISettingsDir = path.join(os.homedir(), '.pearai');
const pearAIDevExtensionsDir = path.join(os.homedir(), '.pearai', 'extensions');

const firstLaunchFlag = path.join(pearAISettingsDir, 'firstLaunch.flag');
export const isFirstLaunch = fs.existsSync(firstLaunchFlag);

function getPearAISettingsDir() {
    const platform = process.platform;
    if (platform === 'win32') {
        return path.join(process.env.APPDATA || '', 'pearai', 'User');
    } else if (platform === 'darwin') {
        return path.join(os.homedir(), 'Library', 'Application Support', 'pearai', 'User');
    } else {
        return path.join(os.homedir(), '.config', 'pearai', 'User');
    }
}

function getVSCodeExtensionsDir() {
    return path.join(os.homedir(), '.vscode', 'extensions');
}


function copyVSCodeSettingsToPearAIDir() {
    const vscodeSettingsDir = getVSCodeSettingsDir();
    const pearAIDevSettingsDir = getPearAISettingsDir();
    const vscodeExtensionsDir = getVSCodeExtensionsDir();

    if (!fs.existsSync(pearAIDevSettingsDir)) {
        fs.mkdirSync(pearAIDevSettingsDir, { recursive: true });
    }

    if (!fs.existsSync(pearAIDevExtensionsDir)) {
        fs.mkdirSync(pearAIDevExtensionsDir, { recursive: true });
    }

    const itemsToCopy = ['settings.json', 'keybindings.json', 'snippets', 'sync', 'globalStorage/state.vscdb', 'globalStorage/state.vscdb.backup'];
    itemsToCopy.forEach(item => {
        const source = path.join(vscodeSettingsDir, item);
        const destination = path.join(pearAIDevSettingsDir, item);
        if (fs.existsSync(source)) {
            if (fs.lstatSync(source).isDirectory()) {
                copyDirectoryRecursiveSync(source, destination);
            } else {
                fs.copyFileSync(source, destination);
            }
        }
    });


    const exclusions = ['pearai.pearai', 'continue.continue']
    const platform = process.platform;
    const arch = process.arch;

    if (platform === "darwin" && arch === "arm64") {
        exclusions.push('vscode-pylance');
    }

    copyDirectoryRecursiveSync(vscodeExtensionsDir, pearAIDevExtensionsDir, exclusions);
}

function getVSCodeSettingsDir() {
    const platform = process.platform;
    if (platform === 'win32') {
        return path.join(process.env.APPDATA || '', 'Code', 'User');
    } else if (platform === 'darwin') {
        return path.join(os.homedir(), 'Library', 'Application Support', 'Code', 'User');
    } else {
        return path.join(os.homedir(), '.config', 'Code', 'User');
    }
}

function copyDirectoryRecursiveSync(source: string, destination: string, exclusions: string[] = []) {
    if (!fs.existsSync(destination)) {
        fs.mkdirSync(destination, { recursive: true });
    }
    fs.readdirSync(source).forEach(item => {
        const sourcePath = path.join(source, item);
        const destinationPath = path.join(destination, item);

        // Check if the current item should be excluded
        const shouldExclude = exclusions.some(exclusion =>
            sourcePath.toLowerCase().includes(exclusion.toLowerCase())
        );

        if (!shouldExclude) {
            if (fs.lstatSync(sourcePath).isDirectory()) {
                copyDirectoryRecursiveSync(sourcePath, destinationPath, exclusions);
            } else {
                fs.copyFileSync(sourcePath, destinationPath);
            }
        }
    });
}

export function importUserSettingsFromVSCode() {
    // this function is synchronous and copying files takes time
    // thats why run it after 3 seconds, until which extension activates.
    setTimeout(() => {
        if (!fs.existsSync(firstLaunchFlag)) {
            vscode.window.showInformationMessage('Copying your current VSCode settings and extensions over to PearAI!');
            copyVSCodeSettingsToPearAIDir();
            fs.writeFileSync(firstLaunchFlag, 'This is the first launch flag file');
            vscode.window.showInformationMessage('Your VSCode settings and extensions have been transferred over to PearAI! You may need to restart your editor for the changes to take effect.', 'Ok');
        }
    }, 3000);
}
