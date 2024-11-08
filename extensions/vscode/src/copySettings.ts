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


async function copyVSCodeSettingsToPearAIDir() {
    const vscodeSettingsDir = getVSCodeSettingsDir();
    const pearAIDevSettingsDir = getPearAISettingsDir();
    const vscodeExtensionsDir = getVSCodeExtensionsDir();

    await fs.promises.mkdir(pearAIDevSettingsDir, { recursive: true });
    await fs.promises.mkdir(pearAIDevExtensionsDir, { recursive: true });

    const itemsToCopy = ['settings.json', 'keybindings.json', 'snippets', 'sync', 'globalStorage/state.vscdb', 'globalStorage/state.vscdb.backup'];
    
    for (const item of itemsToCopy) {
        const source = path.join(vscodeSettingsDir, item);
        const destination = path.join(pearAIDevSettingsDir, item);
        
        try {
            if (await fs.promises.access(source).then(() => true).catch(() => false)) {
                const stats = await fs.promises.lstat(source);
                if (stats.isDirectory()) {
                    await copyDirectoryRecursiveSync(source, destination);
                } else {
                    await fs.promises.copyFile(source, destination);
                }
            }
        } catch (error) {
            console.error(`Error copying ${item}: ${error}`);
        }
    }

    const exclusions = [
        'pearai.pearai',
        'ms-python.vscode-pylance',
        'ms-python.python',
        'supermaven',
        'codeium',
        'github.copilot',
        'continue'
    ];

    await copyDirectoryRecursiveSync(vscodeExtensionsDir, pearAIDevExtensionsDir, exclusions);
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

async function copyDirectoryRecursiveSync(source: string, destination: string, exclusions: string[] = []) {
    await fs.promises.mkdir(destination, { recursive: true });
    
    const items = await fs.promises.readdir(source);
    for (const item of items) {
        const sourcePath = path.join(source, item);
        const destinationPath = path.join(destination, item);

        const shouldExclude = exclusions.some(exclusion =>
            sourcePath.toLowerCase().includes(exclusion.toLowerCase())
            
        );

        if (!shouldExclude) {
            const stats = await fs.promises.lstat(sourcePath);
            if (stats.isDirectory()) {
                await copyDirectoryRecursiveSync(sourcePath, destinationPath, exclusions);
            } else {
                await fs.promises.copyFile(sourcePath, destinationPath);
            }
        }
    }
}


export async function importUserSettingsFromVSCode() {
    try {
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        vscode.window.showInformationMessage('Copying your current VSCode settings and extensions over to PearAI!');
        await copyVSCodeSettingsToPearAIDir();
        
        vscode.window.showInformationMessage(
            'Your VSCode settings and extensions have been transferred over to PearAI! You may need to restart your editor for the changes to take effect.',
            'Ok'
        );
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to copy settings: ${error}`);
    }
}

export async function markCreatorOnboardingCompleteFileBased() {
    try {
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        const flagFile = firstPearAICreatorLaunchFlag;
        const productName = 'PearAI Creator';
        
        const exists = await fs.promises.access(flagFile).then(() => true).catch(() => false);
        if (!exists) {
            await fs.promises.writeFile(flagFile, `This is the first launch flag file for ${productName}`);
        }
    } catch (error) {
        console.error('Error marking creator onboarding complete:', error);
    }
}
