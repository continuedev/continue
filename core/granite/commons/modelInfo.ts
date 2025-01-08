export const DEFAULT_MODEL_INFO = new Map<string, ModelInfo>();
[{
  id: 'nomic-embed-text:latest',
  size: '274MB',
  digest: ''
},
{
  id: 'granite3.1-dense:2b',
  size: '1.5GB',
  digest: ''
},
{
  id: 'granite3.1-dense:8b',
  size: '4.9GB',
  digest: ''
},
{
  id: 'granite-code:3b',
  size: '2GB',
  digest: ''
},
{
  id: 'granite-code:8b',
  size: '4GB',
  digest: ''
}
].forEach((m: ModelInfo) => {
  DEFAULT_MODEL_INFO.set(m.id, m);
});

export interface ModelInfo {
  id: string;
  size: string;
  digest: string;
}
