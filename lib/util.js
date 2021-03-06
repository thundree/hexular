const fs = require('fs');
const process = require('process');
const pth = require('path');
const yaml = require('yaml');

const OVERRIDE_ENV = process.env.env;

const [readFile, writeFile, copyFile] = promisify(fs.readFile, fs.writeFile, fs.copyFile);

function config(defaultEnv=OVERRIDE_ENV, overrides={}, configFile='config') {
  if (!configFile.match(/\.\w+$/))
    configFile += '.yml';
  let env = OVERRIDE_ENV || defaultEnv;
  console.log(`Building config for ${env} environment...`);
  let configYaml = fs.readFileSync(join('./config', configFile), 'utf8');
  let rootConfig = yaml.parse(configYaml);
  return merge({}, rootConfig.default, rootConfig[env], overrides, {env});
}

function join(...args) {
  return pth.join(__dirname, '..', ...args);
};

function merge(...objs) {
  let base = objs.shift();
  let next;
  while (objs.length) {
    next = objs.shift();
    if (next == null)
      continue;
    for (let [key, value] of Object.entries(next)) {
      if (value === undefined) continue;
      if (typeof base[key] =='object' && typeof value == 'object' && !Array.isArray(base[key])) {
        base[key] = merge({}, base[key], value);
      }
      else {
        base[key] = value;
      }
    }
  }
  return base;
}

function promisify(...fnArgs) {
  let result = fnArgs.map((fn) => (...args) => {
    return new Promise((resolve, reject) => {
      args = args.concat((err, data) => {
        if (err)
          reject(err);
        else
          resolve(data);
      });
      fn(...args);
    });
  });
  return result.length == 1 ? result[0] : result;
};

module.exports = {
  config, join, merge, promisify,
  readFile, writeFile, copyFile
};
