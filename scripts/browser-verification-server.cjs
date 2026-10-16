// Temporary frontend for the isolated local browser verification backend.
process.env.NEXT_PUBLIC_API_URL='http://localhost:5001';
const next=require('next'),{createServer}=require('node:http');
const app=next({dev:true,hostname:'localhost',port:3001,conf:{distDir:'storage/browser-next'}});
app.prepare().then(()=>createServer(app.getRequestHandler()).listen(3001,'127.0.0.1',()=>console.log('Isolated browser frontend: http://localhost:3001')));
