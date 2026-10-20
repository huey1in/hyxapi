const { contextBridge } = require('electron');

const argument = process.argv.find((value) => value.startsWith('--hyxware-data-dir='));
contextBridge.exposeInMainWorld('electron', Object.freeze({
  isElectron: true,
  platform: process.platform,
  version: process.versions.electron,
  dataDir: argument ? decodeURIComponent(argument.slice('--hyxware-data-dir='.length)) : undefined,
}));
