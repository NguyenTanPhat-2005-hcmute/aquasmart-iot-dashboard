const fetch = require('node-fetch'); // we can use node >= 18 native fetch

const key = "AIzaSyCUcmE15N5m4tOd3foayp36Mqdb7xKssPk";
const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`;

async function test() {
    const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            contents: [{role: "user", parts: [{text: "Hello"}]}]
        })
    });
    console.log(res.status, await res.text());
}
test();
