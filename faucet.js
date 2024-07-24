const fs = require('fs');
const solana = require('@solana/web3.js');
const base58 = require('bs58');
const crypto = require('crypto');
const { faker } = require('@faker-js/faker');
const { SocksProxyAgent } = require('socks-proxy-agent');
require('colors');

const PRIVATE_KEYS = JSON.parse(fs.readFileSync('privateKeys.json', 'utf-8'));
const captchaKey = 'api key';

const delay = (seconds) => new Promise((resolve) => setTimeout(resolve, seconds * 1000));

function getKeypair(privateKey) {
    const decodedPrivateKey = base58.decode(privateKey);
    return solana.Keypair.fromSecretKey(decodedPrivateKey);
}

function generateRandomString(length) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    return Array.from({ length }, () => chars[crypto.randomInt(chars.length)]).join('');
}

async function twocaptcha_turnstile(sitekey, pageurl) {
    try {
        const getTokenResponse = await fetch(`https://2captcha.com/in.php?key=${captchaKey}&method=turnstile&sitekey=${sitekey}&pageurl=${pageurl}&json=1`);
        const getTokenText = await getTokenResponse.text();
        
        if (getTokenText === 'ERROR_WRONG_USER_KEY' || getTokenText === 'ERROR_ZERO_BALANCE') {
            return getTokenText;
        }
        
        const getToken = getTokenText.split('|');
        if (getToken[0] !== 'OK') {
            return 'FAILED_GETTING_TOKEN';
        }
        
        const task = getToken[1];
        for (let i = 0; i < 60; i++) {
            const tokenResponse = await fetch(`https://2captcha.com/res.php?key=${captchaKey}&action=get&id=${task}&json=1`);
            const token = await tokenResponse.json();
            
            if (token.status === 1) {
                return token;
            }
            await delay(2);
        }
    } catch (error) {
        console.error('Error getting token:', error);
    }
    return 'FAILED_GETTING_TOKEN';
}

async function claimFaucet(url, address) {
    const maxRetries = 5;
    const userAgent = faker.internet.userAgent();
    const proxy_str = generateRandomString(10);
    const proxyUrl = `socks5://5BE434A53DB6C369-residential-country_HK-r_30m-s_${proxy_str}:jFWGxRob@gate.nstproxy.io:24125`;
    const agent = new SocksProxyAgent(proxyUrl);

    for (let retryTimes = 0; retryTimes < maxRetries; retryTimes++) {
        const bearer = await twocaptcha_turnstile('0x4AAAAAAAc6HG1RMG_8EHSC', 'https://faucet.sonic.game/#/');
        if (['ERROR_WRONG_USER_KEY', 'ERROR_ZERO_BALANCE', 'FAILED_GETTING_TOKEN'].includes(bearer)) {
            console.log(`${address} 获取bearer令牌失败, 重试 (${retryTimes + 1}/${maxRetries})`.yellow);
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

            if (res.status === 'ok') {
                return `Successfully claim faucet 0.5 SOL!`.green;
            } else {
                console.log(`${address} 领水请求返回失败, 重试 (${retryTimes + 1}/${maxRetries}), ${res.message})`.yellow);
                await delay(2);
            }
        } catch (error) {
            console.log(`${address} 领水请求发送失败, 重试 (${retryTimes + 1}/${maxRetries}), ${error})`.yellow);
            await delay(2);
        }
    }
    return `Failed to claim faucet after ${maxRetries} retries.`.red;
}

(async () => {
    try {
        for (const privateKey of PRIVATE_KEYS) {
            const publicKey = getKeypair(privateKey).publicKey.toBase58();
            console.log(`${publicKey} 开始领水`.green);
            
            const faucet_result = await claimFaucet('https://faucet-api.sonic.game/airdrop', publicKey);
            console.log(`${publicKey}领水结果: ${faucet_result}`);
            await delay(5);
        }
    } catch (error) {
        console.error('Error in main function:', error);
    }
})();
