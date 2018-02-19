const READ_PKG_UP = require('read-pkg-up');
const PATH = require('path');
const FS = require('fs-extra');
const MERGE_WITH = require('lodash.mergewith');

const SEP = PATH.sep;
const TS_CONIFG_FILE_NAME = 'tsconfig.json';

function mergeCustomizer(objValue, srcValue, key, object, source){
	if(objValue instanceof Array && srcValue instanceof Array){
		let arr = [];
		for(let val of srcValue){
			if(objValue.indexOf(val) === -1){
				objValue.push(val);
			};
		};
		return objValue;
	};
};

//Get package.json and tsconfig.json
(new Promise((resolve)=>setTimeout(resolve,1000)))
	.then(()=>Promise.all([READ_PKG_UP({cwd:PATH.normalize(`${__dirname}/..`), normalize:false}), FS.readJson(PATH.normalize(`${__dirname}${SEP}${TS_CONIFG_FILE_NAME}`))]))
	.then((results) => {

		let result = results[0];

		result.tsconfig = results[1];
		result.tsconfigPath = PATH.normalize(`${PATH.parse(result.path).dir}${SEP}${TS_CONIFG_FILE_NAME}`);

		//Add typescript build command to package npm scripts
		MERGE_WITH(result.pkg, {
			scripts: {
				"ts-build": "tsc",
			}
		}, mergeCustomizer);

		//Merge current tsconfig with new tsconfig
		//Ensure tsconfig path
		//Backup current package and tsconfig
		//Does NOT overwrite current tsconfig
		return FS.pathExists(result.tsconfigPath)
			.then((exsists)=> exsists ? FS.readJson(result.tsconfigPath) : null)
			.then((curTsconfig)=> curTsconfig === null ? FS.ensureFile(result.tsconfigPath) : MERGE_WITH(result.tsconfig, curTsconfig, mergeCustomizer))
			.then(()=>{

				let tsconfigParse = PATH.parse(result.tsconfigPath);
				tsconfigParse.base = `.${tsconfigParse.base}.BAK`;

				let packageParse = PATH.parse(result.path);
				packageParse.base = `.${packageParse.base}.BAK`;

				return Promise.all([
					FS.copy(result.tsconfigPath, PATH.format(tsconfigParse),{ overwrite: true }),
					FS.copy(result.path, PATH.format(packageParse),{ overwrite: true })
				])
			})
			.then(()=>result);

	})
	//Write package and tsconfig
	.then((result)=>{
		return Promise.all([
			FS.writeJson(result.tsconfigPath, result.tsconfig, {spaces:'\t'}),
			FS.writeJson(result.path, result.pkg, {spaces:'\t'})
		]).then(()=>result);
	})
	.then((result)=> console.log(`"ts-config" init complete. Updated:\n\t${result.tsconfigPath}\n\t${result.path}`))
	.catch(console.error);
