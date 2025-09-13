import path from "path";
import {readFileSync, existsSync, mkdirSync, writeFileSync} from 'fs';
import {fileURLToPath} from "url";
import {getSitesMap} from "./sites-map.js";
import '../libs_drpy/jinja.js'


const __dirname = path.dirname(fileURLToPath(import.meta.url));
const _data_path = path.join(__dirname, '../data');
const _config_path = path.join(__dirname, '../config');
const _lib_path = path.join(__dirname, '../spider/js');

const es6JsPath = path.join(__dirname, '../libs_drpy/es6-extend.js');
// 读取扩展代码
export const es6_extend_code = readFileSync(es6JsPath, 'utf8');
const reqJsPath = path.join(__dirname, '../libs_drpy/req-extend.js');
// 读取网络请求扩展代码
export const req_extend_code = readFileSync(reqJsPath, 'utf8');

export const SitesMap = getSitesMap(_config_path);
export const pathLib = {
    basename: path.basename,
    extname: path.extname,
    readFile: function (filename) {
        let _file_path = path.join(_data_path, filename);
        const resolvedPath = path.resolve(_data_path, _file_path); // 将路径解析为绝对路径
        if (!resolvedPath.startsWith(_data_path)) {
            log(`[pathLib.readFile] no access for read ${_file_path}`)
            return '';
        }
        // 检查文件是否存在
        if (!existsSync(resolvedPath)) {
            log(`[pathLib.readFile] file not found for read ${resolvedPath}`)
            return '';
        }
        return readFileSync(resolvedPath, 'utf8')
    },
    writeFile: function (filename, text) {
        let _file_path = path.join(_data_path, filename);
        const resolvedPath = path.resolve(_data_path, _file_path); // 将路径解析为绝对路径
        if (!resolvedPath.startsWith(_data_path)) {
            log(`[pathLib.writeFile] no access for read ${_file_path}`)
            return '';
        }
        try {
            const dirPath = path.dirname(resolvedPath);
            // 检查目录是否存在，不存在则创建
            if (!existsSync(dirPath)) {
                mkdirSync(dirPath, {recursive: true});
            }
            writeFileSync(resolvedPath, text, 'utf8');
            return true
        } catch (e) {
            log(`[pathLib.writeFile] failed for saveFile ${_file_path}　error:${e.message}`);
            return false
        }
    },
    readLib: function (filename) {
        let _file_path = path.join(_lib_path, filename);
        const resolvedPath = path.resolve(_data_path, _file_path); // 将路径解析为绝对路径
        if (!resolvedPath.startsWith(_lib_path)) {
            log(`[pathLib.readLib] no access for read ${_file_path}`)
            return '';
        }
        // 检查文件是否存在
        if (!existsSync(resolvedPath)) {
            log(`[pathLib.readLib] file not found for read ${resolvedPath}`)
            return '';
        }
        return readFileSync(resolvedPath, 'utf8')
    },
};

export function getParsesDict(host) {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const jx_conf = path.join(__dirname, '../config/parses.conf');
    let jx_list = [];
    if (existsSync(jx_conf)) {
        const jx_conf_text = readFileSync(jx_conf, 'utf-8');
        let jx_conf_content = jx_conf_text.trim();
        let var_dict = {host, hostName: host.split(':').length > 1 ? host.slice(0, host.lastIndexOf(":")) : host};
        // console.log(var_dict);
        jx_conf_content = jinja.render(jx_conf_content, var_dict);
        const jxs = jx_conf_content.split('\n').filter(it => it.trim() && !it.trim().startsWith('#')).map(it => it.trim());
        // console.log(jxs);
        jxs.forEach((jx) => {
            let jx_arr = jx.split(',');
            let jx_name = jx_arr[0];
            let jx_url = jx_arr[1];
            let jx_type = jx_arr.length > 2 ? Number(jx_arr[2]) || 0 : 0;
            let jx_ua = jx_arr.length > 3 ? jx_arr[3] : 'Mozilla/5.0';
            let jx_flag = jx_arr.length > 4 ? jx_arr[4] : '';
            let jx_obj = {
                'name': jx_name,
                'url': jx_url,
                'type': jx_type,
                "header": {
                    "User-Agent": jx_ua
                },
            }
            if (jx_flag) {
                jx_obj.ext = {
                    "flag": jx_flag.split('|')
                }
            }
            jx_list.push(jx_obj);
        });
    }
    // console.log('getParsesDict:', jx_conf);
    // console.log(jx_list);
    return jx_list
}
