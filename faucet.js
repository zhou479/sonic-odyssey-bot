const fs = require('fs');
const solana = require('@solana/web3.js');
const base58 = require('bs58');
const crypto = require('crypto');
const { faker } = require('@faker-js/faker');
const { SocksProxyAgent } = require('socks-proxy-agent');
require('colors');


const PRIVATE_KEYS = JSON.parse(fs.readFileSync('privateKeys.json', 'utf-8'));
const captchaKey = '193947af5df36f28d69ad1dd0db9c1a5';

const delay = (seconds) => {
    return new Promise((resolve) => {
        return setTimeout(resolve, seconds * 1000);
    });
}

function getKeypair(privateKey) {
    const decodedPrivateKey = base58.decode(privateKey);
    return solana.Keypair.fromSecretKey(decodedPrivateKey);
}

function generateRandomString(length) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const charLength = chars.length;
    let result = '';

    for (let i = 0; i < length; i++) {
        const randomIndex = crypto.randomInt(charLength);
        result += chars[randomIndex];
    }

    return result;
}

const twocaptcha_turnstile = (sitekey, pageurl) => new Promise(async (resolve) => {
    try {
        const getToken = await fetch(`https://2captcha.com/in.php?key=${captchaKey}&method=turnstile&sitekey=${sitekey}&pageurl=${pageurl}&json=1`, {
            method: 'GET'
        })
        .then(res => res.text())
        .then(res => {
            if (res == 'ERROR_WRONG_USER_KEY' || res == 'ERROR_ZERO_BALANCE') {
                return resolve(res);
            } else {
                return res.split('|');
            }
        });

        if (getToken[0] != 'OK') {
            resolve('FAILED_GETTING_TOKEN');
        }
    
        const task = getToken[1];

        for (let i = 0; i < 60; i++) {
            const token = await fetch(
                `https://2captcha.com/res.php?key=${captchaKey}&action=get&id=${task}&json=1`
            ).then(res => res.json());
            
            if (token.status == 1) {
                resolve(token);
                break;
            }
            await delay(2);
        }
    } catch (error) {
        resolve('FAILED_GETTING_TOKEN');
    }
});

const claimFaucet = (url, address) => new Promise(async (resolve) => {
    let retryTimes = 0;
    const maxRetries = 5;
    const userAgent = faker.internet.userAgent();
    const proxy_str = generateRandomString(10);
    const proxyUrl = `socks5://5BE434A53DB6C369-residential-country_HK-r_30m-s_${proxy_str}:jFWGxRob@gate.nstproxy.io:24125`;
    const agent = new SocksProxyAgent(proxyUrl);

    while (retryTimes < maxRetries) {
        const bearer = await twocaptcha_turnstile('0x4AAAAAAAc6HG1RMG_8EHSC', 'https://faucet.sonic.game/#/');
        if (bearer == 'ERROR_WRONG_USER_KEY' || bearer == 'ERROR_ZERO_BALANCE' || bearer == 'FAILED_GETTING_TOKEN' ) {
            console.log(`${address} 获取bearer令牌失败, 重试 (${retryTimes + 1}/${maxRetries})`.yellow);
            retryTimes++;
            await delay(2);
            continue;
        }

        try {
            const res = await fetch(`${url}/${address}/0.5/${bearer.request}`, {
                headers: {
                    "Accept": "application/json, text/plain, */*",
                    "Content-Type": "application/json",
                    "Accept-Language": "en-US,en;q=0.9,id;q=0.8",
                    "Dnt": "1",
                    "Origin": "https://faucet.sonic.game",
                    "Priority": "u=1, i",
                    "Referer": "https://faucet.sonic.game/",
                    "User-Agent": userAgent,
                    "sec-ch-ua-mobile": "?0",
                    "sec-ch-ua-platform": "Windows",
                },
                agent
            }).then(res => res.json());
    
            if (res.status == 'ok') {
                resolve(`Successfully claim faucet 0.5 SOL!`.green);
            } 
            else {
                console.log(`${address} 领水请求返回失败, 重试 (${retryTimes + 1}/${maxRetries}), ${res.message})`.yellow);
                break;
            }
        } catch (error) {
            console.log(`${address} 领水请求发送失败, 重试 (${retryTimes + 1}/${maxRetries}), ${error})`.yellow);
            retryTimes++;
        }
    }
    resolve(`Failed to claim faucet after ${maxRetries} retries.`.red);
});



(async () => {
    try {
        for (let i = 0; i < PRIVATE_KEYS.length; i++) {

            //获取地址
            const privateKey = PRIVATE_KEYS[i];
            const publicKey = getKeypair(privateKey).publicKey.toBase58();
            console.log(`${publicKey} 开始领水`.green);
            
            //执行领水
            const faucet_result = await claimFaucet('https://faucet-api.sonic.game/airdrop', publicKey);
            // const faucet_result = await claimFaucet('https://faucet-api-grid-1.sonic.game', publicKey);
            console.log(`${publicKey}领水结果: ${faucet_result}`);
            delay(5);
        }
    } catch (error) {
        console.error(error);
    }
})();
