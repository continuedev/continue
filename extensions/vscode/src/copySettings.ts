import * as vscode from "vscode";
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export const FIRST_LAUNCH_KEY = 'pearai.firstLaunch';
const pearAISettingsDir = path.join(os.homedir(), '.pearai');
const pearAIDevExtensionsDir = path.join(os.homedir(), '.pearai', 'extensions');

const firstLaunchFlag = path.join(pearAISettingsDir, 'firstLaunch.flag');
const firstPearAICreatorLaunchFlag = path.join(pearAISettingsDir, 'firstLaunchCreator.flag');
export const isFirstPearAICreatorLaunch = !fs.existsSync(firstPearAICreatorLaunchFlag);

// Removed file based flag migration, we show new onboarding to old users
export function isFirstLaunch(context: vscode.ExtensionContext): boolean {
    const stateExists = context.globalState.get<boolean>(FIRST_LAUNCH_KEY);
    console.log("isFirstLaunch");
    console.log(!stateExists);
    // If state is set and is true, it's not first launch
    return !stateExists;
}


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

     // Built-in extensions
    exclusions.push('supermaven');
    if (platform === "darwin" && arch === "arm64") {
        exclusions.push('ms-python.vscode-pylance');
        exclusions.push('ms-python.python');
    }

    // EXCLUDE CONFLICTING EXTENSIONS
    exclusions.push('codeium');
    exclusions.push('github.copilot');
    exclusions.push('continue');

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


export async function importUserSettingsFromVSCode() {
    // this function is synchronous and copying files takes time
    // thats why run it after 3 seconds, until which extension activates.
    // todo: route to onboarding hello page
    setTimeout(() => {
        try {
            // TODO: THIS MSG SHOULD BE IN OVERLAY
            vscode.window.showInformationMessage('Copying your current VSCode settings and extensions over to PearAI!');
            copyVSCodeSettingsToPearAIDir();
            // No longer write flag to a file, just set state
            // fs.writeFileSync(firstLaunchFlag, 'This is the first launch flag file');

            // TODO: THIS MSG SHOULD BE IN OVERLAY
            vscode.window.showInformationMessage('Your VSCode settings and extensions have been transferred over to PearAI! You may need to restart your editor for the changes to take effect.', 'Ok');
        } catch (error) {
            // TODO: DISPLAY ERROR MSG IN OVERLAY
            vscode.window.showErrorMessage(`Failed to copy settings: ${error}`);
        }

    }, 3000);
}

export async function markCreatorOnboardingCompleteFileBased() {
    // todo: use global state for this as well
    setTimeout(() => {
        const flagFile = firstPearAICreatorLaunchFlag;
        const productName ='PearAI Creator';
        if (!fs.existsSync(flagFile)) {
            fs.writeFileSync(flagFile, `This is the first launch flag file for ${productName}`);
        }
    }, 3000);
}
