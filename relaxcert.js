const {exec, execSync, spawn} = require('child_process');
const ConfigParser = require('@webantic/nginx-config-parser')
let crontab = require('crontab')
const fs = require("fs");
const path = require("path");
const logger = require('./logger').createLogger(path.join(__dirname, "../log/relaxcert.log"));
const nginxParser = new ConfigParser()

// parse straight from file. by default, will try to resolve includes

const baseHost = "https://cert.relaxcert.com"
let nginxPath = null;
let nginxConfPath = null;
let token = null;
let certDownloaded = false

process.on('warning', (warning) => {
    if (warning.name !== 'DeprecationWarning') {
        console.warn(warning.name);
        console.warn(warning.message);
        console.warn(warning.stack);
    }
});

function error(content) {
    logger.error(content)
    console.log('\x1b[31m%s\x1b[0m', content)
}

function info(content) {
    logger.info(content)
    console.log(content)
}

function success(content) {
    logger.info(content)
    console.log('\x1b[32m%s\x1b[0m', content)
}

function reqUrl(url, data) {
    var cmd = `curl -s '${url}' -X POST -H 'Content-Type:application/json;' -H 'token:${token}' -d '${JSON.stringify(data)}'`
    let resp = execSync(cmd);
    return resp.toString();
}

function reqUrlWithFiles(url, data, files) {
    let fileCmd = "";
    for (let file of files) {
        fileCmd += ` -F ${file.key}=@"${file.path}"`
    }
    var cmd = `curl -s  -X POST -H 'token:${token}' -H  'Content-Type: multipart/form-data' -F 'data=${encodeURIComponent(JSON.stringify(data))}' ${fileCmd} '${url}'`
    let resp = execSync(cmd);
    return resp.toString();
}

async function grepNginxPid() {
    return new Promise((resolve, reject) => {
        const ps = spawn('ps', ['ax']);
        const grep = spawn('grep', ['nginx']);

        ps.stdout.on('data', (data) => {
            grep.stdin.write(data);
        });

        ps.stderr.on('data', (data) => {
            reject()
        });

        ps.on('close', (code) => {
            if (code !== 0) {
                console.log(`ps process exited with code ${code}`);
            }
            grep.stdin.end();
        });

        grep.stdout.on('data', (data) => {
            let outputArr = data.toString().split("\n");
            let pid = "";
            for (let i = 0; i < outputArr.length; i++) {
                if (outputArr[i].indexOf("master") >= 0) {
                    pid = outputArr[i].trim().split(" ")[0]
                    break;
                }
            }
            resolve(pid)
        });

        grep.stderr.on('data', (data) => {
            reject()
        });

        grep.on('close', (code) => {
            if (code !== 0) {
                console.log(`grep process exited with code ${code}`);
            }
        });
    })
}

async function grepNginxConf() {
    return new Promise((resolve, reject) => {
        try {
            exec(`${nginxPath} -t  2>&1 | grep 'configuration'`, (error, stdout, stderr) => {
                if (error) {
                    // console.error(`exec error: ${error}`);
                    return;
                }

                let nginxConfStr = stdout.toString();
                let endIndex = nginxConfStr.indexOf("syntax")
                if (endIndex < 0) {
                    endIndex = nginxConfStr.indexOf("test")
                }
                if (endIndex < 0) {
                    reject()
                } else {
                    nginxConfPath = nginxConfStr.slice(nginxConfStr.indexOf("configuration") + 19, endIndex - 1)
                    resolve(nginxConfPath)
                }

            });

        } catch (e) {

        }

    })
}

/**
 * Check if set crontab.
 * If not set,create a job.
 */
function checkAndSetCrontab() {
    crontab.load(function (err, crontab) {
        // show all jobs
        let jobs = crontab.jobs();
        let setted = false;
        for (let job of jobs) {
            let command = job.command();
            if (command.indexOf("relaxcert/relaxcert.sh") >= 0) {
                setted = true;
            }
        }
        if (!setted) {
            var job = crontab.create('sh /usr/.relaxcert/relaxcert/relaxcert.sh');
            job.minute().at(Math.floor(Math.random() * 60));
            job.hour().at(Math.floor(Math.random() * 8));
            crontab.save();
            crontab.reset()
        }
    })
}



async function check() {
    let tokenPath = path.join(__dirname, "../token")
    if (process.argv.length < 3) {
        if (!fs.existsSync(tokenPath)) {
            error(`Please log in to the console https://relaxcert.com to copy the correct command before executing.`)
            return;
        }
        token = fs.readFileSync(tokenPath).toString()
    } else {
        token = process.argv[2];
        fs.writeFileSync(tokenPath, token)
    }
    checkAndSetCrontab()

    try {
        let nginxPidBuf = await grepNginxPid();
        let nginxPid = nginxPidBuf.toString().replace("\n", "")
        if (nginxPid.length > 0) {
            let nginxPsBuf = execSync(`readlink -f /proc/${nginxPid}/exe`);
            nginxPath = nginxPsBuf.toString().replace("\n", "");
        }


        if ((!nginxPath) || nginxPath.length < 2) {
            nginxPath = execSync('whereis nginx').toString().replace("nginx:", "");
        }
        success("Found nginx in " + nginxPath)
        if ((!nginxPath) || nginxPath.length == 0 || nginxPath.indexOf("/") < 0) {
            error("No nginx running or added to system variables found.")
            return;
        }
        let nginxConfPath = await grepNginxConf()
        if (!nginxConfPath) {
            error("Nginx configuration not found.")
            return;
        }
        info(`Nginx configuration file is found in ${nginxConfPath}`);
        //Read relaxcert configuration.
        info(`Reading relaxcert configuration.`);
        info(`If you want to exclude some sites or configure certain sites not to join site monitoring, please read the reference document https://doc.relaxcert.com/relaxcert-nginx-conf.html,then edit the configuration file.`)
        info(`The path of the relaxcert configuration file is /usr/.relaxcert/conf/conf.json`)
        let relaxcertConf = {};
        if(!fs.existsSync("/usr/.relaxcert/conf")){
            fs.mkdirSync("/usr/.relaxcert/conf")
            fs.writeFileSync("/usr/.relaxcert/conf/conf.json",JSON.stringify({
                "exclude":[],
                "include":[],
                "domain":{}
            },null,4))
        }else{
            if(!fs.existsSync("/usr/.relaxcert/conf/conf.json")){
                fs.writeFileSync("/usr/.relaxcert/conf/conf.json",JSON.stringify({
                    "exclude":[],
                    "include":[],
                    "domain":{}
                },null,4))
            }else{
                try{
                    relaxcertConf = JSON.parse(fs.readFileSync("/usr/.relaxcert/conf/conf.json").toString())
                }catch (e) {

                }

            }
        }
        info("Checking nginx configuration.");
        let nginxConfObj = nginxParser.readConfigFile(nginxConfPath, {parseIncludes: true,ignoreIncludeErrors:true})
        let servers = [];
        if (nginxConfObj.http && nginxConfObj.http.server) {
            let serverArr = nginxConfObj.http.server;
            for (let svr of serverArr) {
                if (svr.ssl_certificate && svr.ssl_certificate_key && svr.server_name) {
                    if(relaxcertConf.exclude&&relaxcertConf.exclude.includes(svr.server_name)){
                        continue;
                    }

                    let server_name = svr.server_name;
                    let single_domain=(relaxcertConf.domain&&relaxcertConf.domain[server_name]&&relaxcertConf.domain[server_name].single_domain===true)?true:false
                    let serverParts = server_name.split(".")
                    let server_host_name=null;
                    if(single_domain){
                        server_host_name=server_name
                    }else{
                        if(serverParts.length==1){
                            continue ;
                        }else if(serverParts.length==2){
                            server_host_name="*."+server_name
                        }else if(serverParts.length==3){
                            if(serverParts[serverParts.length-2].length<=3){
                                //example.com.cn->*.example.com.cn
                                //example.co.jp->*.example.co.jp
                                server_host_name="*."+server_name
                            }else{
                                //a.example.com->*.example.com
                                server_host_name="*."+serverParts[serverParts.length-2]+"."+serverParts[serverParts.length-1]
                            }
                        }else if(serverParts.length>3){
                            //a.example.com.cn->*.example.com.cn
                            //a.b.example.com.cn->*.b.example.com.cn
                            //a.b.example.com->*.b.example.com
                            server_host_name="*";
                            for(let i=1;i<serverParts.length;i++){
                                server_host_name+=("."+serverParts[i])
                            }
                        }
                    }

                    servers.push({
                        server_port: svr.listen?(Array.isArray(svr.listen)?svr.listen[svr.listen.length-1].split(" ")[0]:'443'):'443',
                        server_name: server_name,
                        server_host_name:server_host_name,
                        cert_path: svr.ssl_certificate,
                        cert_key_path: svr.ssl_certificate_key,
                        cert_only:(relaxcertConf.domain&&relaxcertConf.domain[server_name]&&relaxcertConf.domain[server_name].cert_only===true)?true:false
                    })
                }
            }
        }
        if (servers.length === 0) {
            error("No https server found in nginx configuration.")
            return;
        }
        let DNSErrArr = []
        let reqServerArr = [];
        for (let server of servers) {

            let resp = null;
            let respObj = null;
            try {
                info("Checking the certificate configuration of "+server.server_name);
                if (fs.existsSync(server.cert_path) && fs.existsSync(server.cert_key_path)) {
                    resp = reqUrlWithFiles(`${baseHost}/api/cert/check`, {server_name: server.server_name,server_host_name: server.server_host_name}, [{
                        key: "cert",
                        path: server.cert_path
                    }, {key: "cert_key", path: server.cert_key_path}])

                    respObj = JSON.parse(resp)
                    if (respObj.code == -100) {
                        error("Token error, please log in  the console site https://relaxcert.com to copy the command and execute.");
                        return;
                    }

                    switch (respObj.data) {
                        case 0:
                            success(`Cert file for ${server.server_name} is valid.`)
                            break;
                        case -1:
                            error(`Cert file for ${server.server_name} is invalid.`)
                            reqServerArr.push({
                                server_name: server.server_name,
                                server_host_name: server.server_host_name,
                                cert_path: server.cert_path,
                                cert_key_path: server.cert_key_path,
                                cert_only:server.cert_only
                            })
                            break;
                        case -2:
                            error(`Certificate validity period for ${server.server_name} is less than 15 days.`)
                            reqServerArr.push({
                                server_name: server.server_name,
                                server_host_name: server.server_host_name,
                                cert_path: server.cert_path,
                                cert_key_path: server.cert_key_path,
                                cert_only:server.cert_only
                            })
                            break;
                    }
                } else {
                    error(`Cert file for ${server.server_name} is invalid.`)
                    reqServerArr.push({
                        server_name: server.server_name,
                        server_host_name: server.server_host_name,
                        cert_path: server.cert_path,
                        cert_key_path: server.cert_key_path,
                        cert_only:server.cert_only
                    })
                }
                resp = reqUrl(`${baseHost}/api/dns/check`, {
                    server_name: server.server_name,
                    server_host_name: server.server_host_name,
                    server_port: server.server_port,
                    cert_only:server.cert_only
                })
                respObj = JSON.parse(resp)
                if(respObj.code!==0){
                    error(respObj.msg)
                    return ;
                }
                if (respObj.data && respObj.data.match) {
                    success(`DNS configuration for ${server.server_name} is valid.`)
                } else {
                    let exsitHost = false
                    for (let item of DNSErrArr) {
                        if (item.Domain === respObj.data.host.replace('_acme-challenge.', "")) {
                            exsitHost = true;
                            break;
                        }
                    }
                    if (!exsitHost) {
                        DNSErrArr.push({
                            "Domain": respObj.data.domain,
                            "Host Record": respObj.data.host,
                            "Record Type": 'CNAME',
                            "Record Value": respObj.data.cname
                        })
                    }

                }

            } catch (e) {
                error(e)
                console.log('\x1b[31m%s\x1b[0m', `Network error, please check your network.`)
            }

        }
        if (DNSErrArr.length > 0) {
            error(`Please configure DNS resolution records according to the following table.`)
            console.table(DNSErrArr);
            error(`After the above configuration is completed, please wait for 1 minute before re executing the installation command.`)
            return;
        }
        if (reqServerArr.length == 0) {
            success(`All certificates are available.`)
            return;
        }
        for (let server of reqServerArr) {

            let resp = reqUrl(`${baseHost}/api/cert/request`, {
                server_name: server.server_name,
                server_host_name: server.server_host_name
            })
            try {
                let respObj = JSON.parse(resp)
                if (respObj.code === 0 && respObj.data) {
                    switch (respObj.data.code) {
                        case 0:
                            //The certificate file already exists, download the file directly.
                            await downloadCert(server)
                            break;
                        case 1:
                            info(`Requesting certificate for ${server.server_name},please wait a moment,about 1-4 minute(s).`)
                            //Requesting certificate file.Refresh the certificate request status.
                            try{
                                await checkCertRequestStatus(server)
                                await downloadCert(server)
                            }catch (e) {
                                
                            }
                           
                            break

                    }
                }else{
                    error(respObj.msg)
                }
            } catch (e) {
                error(`Requesting certificate for ${server.server_name} timeout.`)
            }
        }
        if (certDownloaded) {
            execSync(`${nginxPath} -s reload`)
            success(`Nginx is reloaded.`)
        } else {
            info("No need reload nginx")
        }
    } catch (e) {
        error(e)
        error("No nginx found or nginx conf error")
    }
}

async function checkCertRequestStatus(server){
    return new Promise(async (resolve, reject) => {
        let startTime = Date.now()
        let timer = setInterval(async () => {
            let cTime = Date.now()
            if (cTime - startTime > 240000) {
                let finalResp = reqUrl(`${baseHost}/api/cert/status`, {
                    server_name: server.server_name,
                    server_host_name: server.server_host_name,
                    skip_verify:true
                })
                try{
                    let finalRespObj = JSON.parse(finalResp)
                    if (finalRespObj.code === 0 && finalRespObj.data.code === 0) {

                        clearInterval(timer)
                        timer = null;
                        resolve()
                        return;
                    }
                }catch (e) {

                }
                error(`Certificate  for ${server.server_name} request timeout.`)
                clearInterval(timer)
                timer = null;
                reject()
                return;
            }
            let resp = reqUrl(`${baseHost}/api/cert/status`, {
                server_name: server.server_name,
                server_host_name: server.server_host_name
            })
            try{
                let respObj = JSON.parse(resp)
                if (respObj.code === 0 && respObj.data.code === 0) {

                    clearInterval(timer)
                    timer = null;
                    resolve()
                }
            }catch (e) {

            }


        }, 20000)
    });
}

async function downloadCert(server) {
    return new Promise(async (resolve, reject) => {
        info(`Downloading certificate  for ${server.server_name}.`)
        let resp = reqUrl(`${baseHost}/api/cert/download`, {
            server_host_name: server.server_host_name,
            server_name: server.server_name
        })

        try {
            let respObj = JSON.parse(resp)
            if (respObj.code === 0 && respObj.data) {
                let dirPath = path.join(`${server.cert_path}`, '..')
                if (!fs.existsSync(dirPath)) {
                    fs.mkdirSync(dirPath, {recursive: true})
                }
                let dirPath2 = path.join(`${server.cert_key_path}`, '..')
                if (!fs.existsSync(dirPath2)) {
                    fs.mkdirSync(dirPath2, {recursive: true})
                }
                //backup cert
                if (fs.existsSync(server.cert_path)) {
                    fs.renameSync(server.cert_path, `${server.cert_path}.bak`)
                }
                if (fs.existsSync(server.cert_key_path)) {
                    fs.renameSync(server.cert_key_path, `${server.cert_key_path}.bak`)
                }
                fs.writeFileSync(`${server.cert_path}`, respObj.data.cert)
                fs.writeFileSync(`${server.cert_key_path}`, respObj.data.key)
                success(`Certificate for ${server.server_name} download successfully.`)
                certDownloaded = true
                resolve()
            } else {
                error(respObj.msg)
                reject()
            }
        } catch (e) {
            error(e)
            error(`Network error, please check your network.`)
            reject()
        }
    })

}

check().then(res => {

})


