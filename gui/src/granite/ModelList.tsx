import React from 'react';
import { ProgressData } from 'core/granite/commons/progressData';
import ProgressBar from './ProgressBar';
import { StatusCheck, StatusValue } from './StatusCheck';
import { ModelStatus } from 'core/granite/commons/statuses';
import { checkModelCompatibility } from 'core/granite/commons/modelRequirements';
import ModelWarning from './ModelWarning';
import { SystemInfo } from 'core/granite/commons/sysInfo';

export interface ModelOption {
    label: string;
    value: string | null;
    info: string | null;
}

interface ModelListProps {
    className: string;
    label: string;
    value: string | null;
    onChange: (option: ModelOption | null) => void;
    status: ModelStatus | null;
    options: ModelOption[];
    progress?: ProgressData;
    tooltip?: string;
    disabled?: boolean;
    systemInfo: SystemInfo | null;
}

const ModelList: React.FC<ModelListProps> = ({ className, label, value, onChange, status, options, progress, tooltip, disabled, systemInfo }) => {
    const selectHeight = '16px';
    const customStyles = {
        container: (base: any) => ({
            ...base,
        }),
        control: (base: any) => ({
            ...base,
            minHeight: selectHeight,
        }),
        dropdownIndicator: (base: any) => ({
            ...base,
            paddingTop: 0,
            paddingBottom: 0,
        }),
        menuList: (base: any) => ({
            ...base,
            fontSize: '12px',
        }),
        option: (base: any, state: { isSelected: boolean; isFocused: boolean }) => ({
            ...base,
            backgroundColor: state.isSelected
                ? 'var(--vscode-list-activeSelectionBackground)'
                : state.isFocused
                    ? 'var(--vscode-list-hoverBackground)'
                    : 'var(--vscode-dropdown-background)',
            color: state.isSelected
                ? 'var(--vscode-list-activeSelectionForeground)'
                : 'var(--vscode-dropdown-foreground)',
            ':active': {
                backgroundColor: 'var(--vscode-list-activeSelectionBackground)',
                color: 'var(--vscode-list-activeSelectionForeground)',
            },
        }),
        menu: (base: any) => ({
            ...base,
            backgroundColor: 'var(--vscode-dropdown-background)',
        }),
    };

    const formatOptionLabel = (modelOption: ModelOption | undefined, { context }: { context: 'menu' | 'value' }) => {
        if (modelOption === undefined)
            return <div></div>

        const isSelected = value === modelOption.value;
        const color = isSelected && context === 'menu' ? 'var(--vscode-quickInputList-focusForeground)' : 'var(--vscode-menu-foreground)';
        const style = {
            display: 'flex',
            width: context === 'menu' ? '250px' : '210px',
            justifyContent: 'space-between',
        };
        return (
            <div style={style}>
                <span style={{ color }}>{modelOption.label}</span>
                <span className='model-option--info' style={{ color }}>{modelOption.info}</span>
            </div>
        );
    };

    const getIconType = (status: ModelStatus | null): StatusValue | null => {
        if (status === null) {
            return null;
        }
        switch (status) {
            case ModelStatus.installed:
                return 'complete';
            case ModelStatus.stale:
                return 'partial';
            case ModelStatus.installing:
                return 'installing';
        }
        return 'missing';
    };

    const getTitle = (status: ModelStatus | null): string | undefined => {
        switch (status) {
            case ModelStatus.stale:
                return 'There is a newer version of this model';
            case ModelStatus.installed:
                return 'This model is already installed';
            case ModelStatus.installing:
                return 'This model is being installed';
            case ModelStatus.missing:
                return 'This model will be installed';
        }
    };

    const getStatusLabel = (status: ModelStatus): string => {
        switch (status) {
            case ModelStatus.stale:
                return '(will be updated)';
            case ModelStatus.missing:
                return '(will be pulled)';
            default:
                return '';
        }
    };

    const { warnings, errors } = checkModelCompatibility(value, systemInfo);

    return (
        <div className="form-group">
            <div className='model-list--outer-wrapper'>

                <label className='model-list--label' htmlFor={label}>
                    <StatusCheck type={getIconType(status)} title={getTitle(status)} />
                    <span title={tooltip}>{label}:</span>
                </label>

                <div className={className + `--wrapper`}>
                    {formatOptionLabel(options.find(option => option.value === value), { context: 'value' })}
                    {status !== null && status !== ModelStatus.installed && !progress && <span className='info-label' style={{ display: 'flex', alignItems: 'center' }}> {getStatusLabel(status)}</span>}
                </div >
            </div >

            <ModelWarning warnings={warnings} errors={errors} />

            <div className='progress-container'>
                {progress && (
                    <div id='progress' style={{ width: "100%", marginTop: "8px" }}>
                        <ProgressBar id={value!} data={progress} />
                    </div>
                )}
            </div>
        </div >
    );
};

export default ModelList;