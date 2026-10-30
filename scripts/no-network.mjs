// Preloaded (`node --import`) by scripts/ci-verify.mjs into the compiled
// CLI. Every way a Node.js process can reach the network is replaced with a
// function that throws, so a full `recall init` run that completes under
// this preload has provably made no network call
// (docs/product-specification.md §20, "No network access").
import dgram from 'node:dgram';
import dns from 'node:dns';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import tls from 'node:tls';

function refuse(name) {
  return () => {
    throw new Error(`Network access attempted during recall init: ${name}`);
  };
}

net.Socket.prototype.connect = refuse('net.Socket.connect');
net.connect = refuse('net.connect');
net.createConnection = refuse('net.createConnection');
tls.connect = refuse('tls.connect');
http.request = refuse('http.request');
http.get = refuse('http.get');
https.request = refuse('https.request');
https.get = refuse('https.get');
dgram.createSocket = refuse('dgram.createSocket');
dns.lookup = refuse('dns.lookup');
dns.resolve = refuse('dns.resolve');
dns.promises.lookup = refuse('dns.promises.lookup');
dns.promises.resolve = refuse('dns.promises.resolve');
globalThis.fetch = refuse('fetch');
