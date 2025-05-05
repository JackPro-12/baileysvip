Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.makeSocket = undefined;
const boom_1 = require("@hapi/boom");
const crypto_1 = require("crypto");
const crypto_2 = require("crypto-js");
const url_1 = require("url");
const util_1 = require("util");
const WAProto_1 = require("../../WAProto");
const Defaults_1 = require("../Defaults");
const Types_1 = require("../Types");
const Utils_1 = require("../Utils");
const WABinary_1 = require("../WABinary");
const Client_1 = require("./Client");
const makeSocket = h => {
  async function r() {
    const a = (0, crypto_1.randomBytes)(32);
    const b = (0, crypto_1.randomBytes)(16);
    var d = (0, Utils_1.derivePairingCodeKey)(g.creds.pairingCode, a);
    d = (0, Utils_1.aesEncryptCTR)(g.creds.pairingEphemeralKeyPair.public, d, b);
    return Buffer.concat([a, b, d]);
  }
  var z;
  const {
    waWebSocketUrl: F,
    connectTimeoutMs: J,
    logger: e,
    keepAliveIntervalMs: K,
    browser: G,
    auth: g,
    printQRInTerminal: T,
    defaultQueryTimeoutMs: U,
    transactionOpts: V,
    qrTimeout: L,
    makeSignalRepository: W
  } = h;
  let t = typeof F === "string" ? new url_1.URL(F) : F;
  h.mobile = h.mobile || t.protocol === "tcp:";
  if (h.mobile && t.protocol !== "tcp:") {
    t = new url_1.URL(`tcp://${Defaults_1.MOBILE_ENDPOINT}:${Defaults_1.MOBILE_PORT}`);
  }
  if (!h.mobile && t.protocol === "wss" && ((z = g?.creds) === null || z === undefined ? 0 : z.routingInfo)) {
    t.searchParams.append("ED", g.creds.routingInfo.toString("base64url"));
  }
  const c = h.socket ? h.socket : h.mobile ? new Client_1.MobileSocketClient(t, h) : new Client_1.WebSocketClient(t, h);
  c.connect();
  const k = (0, Utils_1.makeEventBuffer)(e);
  const M = Utils_1.Curve.generateKeyPair();
  const A = (0, Utils_1.makeNoiseHandler)({
    keyPair: M,
    NOISE_HEADER: h.mobile ? Defaults_1.MOBILE_NOISE_HEADER : Defaults_1.NOISE_WA_HEADER,
    mobile: h.mobile,
    logger: e,
    routingInfo: g?.creds?.routingInfo
  });
  const {
    creds: l
  } = g;
  const C = (0, Utils_1.addTransactionCapability)(g.keys, e, V);
  z = W({
    creds: l,
    keys: C
  });
  let H;
  let u = 1;
  let N;
  let I;
  let O = false;
  const v = (0, Utils_1.generateMdTagPrefix)();
  const Y = (0, util_1.promisify)(c.send);
  const D = async a => {
    if (!c.isOpen) {
      throw new boom_1.Boom("Connection Closed", {
        statusCode: Types_1.DisconnectReason.connectionClosed
      });
    }
    const b = A.encodeFrame(a);
    await (0, Utils_1.promiseTimeout)(J, async (d, f) => {
      try {
        await Y.call(c, b);
        d();
      } catch (m) {
        f(m);
      }
    });
  };
  const w = a => {
    if (e.level === "trace") {
      e.trace({
        xml: (0, WABinary_1.binaryNodeToString)(a),
        msg: "xml send"
      });
    }
    a = (0, WABinary_1.encodeBinaryNode)(a);
    return D(a);
  };
  const Z = async a => {
    if (!c.isOpen) {
      throw new boom_1.Boom("Connection Closed", {
        statusCode: Types_1.DisconnectReason.connectionClosed
      });
    }
    let b;
    let d;
    const f = (0, Utils_1.promiseTimeout)(J, (m, n) => {
      b = m;
      d = mapWebSocketError(n);
      c.on("frame", b);
      c.on("close", d);
      c.on("error", d);
    }).finally(() => {
      c.off("frame", b);
      c.off("close", d);
      c.off("error", d);
    });
    if (a) {
      D(a).catch(d);
    }
    return f;
  };
  const P = async (a, b = U) => {
    let d;
    let f;
    try {
      return await (0, Utils_1.promiseTimeout)(b, (m, n) => {
        d = m;
        f = q => {
          n(q || new boom_1.Boom("Connection Closed", {
            statusCode: Types_1.DisconnectReason.connectionClosed
          }));
        };
        c.on(`TAG:${a}`, d);
        c.on("close", f);
        c.off("error", f);
      });
    } finally {
      c.off(`TAG:${a}`, d);
      c.off("close", f);
      c.off("error", f);
    }
  };
  const y = async (a, b) => {
    a.attrs.id ||= `${v}${u++}`;
    b = P(a.attrs.id, b);
    await w(a);
    a = await b;
    if ("tag" in a) {
      (0, WABinary_1.assertNodeErrorFree)(a);
    }
    return a;
  };
  const ba = async () => {
    var a = {
      clientHello: {
        ephemeral: M.public
      }
    };
    a = WAProto_1.proto.HandshakeMessage.fromObject(a);
    e.info({
      browser: G,
      helloMsg: a
    }, "connected to WA");
    a = WAProto_1.proto.HandshakeMessage.encode(a).finish();
    a = await Z(a);
    a = WAProto_1.proto.HandshakeMessage.decode(a);
    e.trace({
      handshake: a
    }, "handshake recv from WA");
    a = A.processHandshake(a, l.noiseKey);
    if (h.mobile) {
      var b = (0, Utils_1.generateMobileNode)(h);
    } else if (l.me) {
      b = (0, Utils_1.generateLoginNode)(l.me.id, h);
      e.info({
        node: b
      }, "logging in...");
    } else {
      b = (0, Utils_1.generateRegistrationNode)(l, h);
      e.info({
        node: b
      }, "not logged in, attempting registration...");
    }
    b = A.encrypt(WAProto_1.proto.ClientPayload.encode(b).finish());
    await D(WAProto_1.proto.HandshakeMessage.encode({
      clientFinish: {
        static: a,
        payload: b
      }
    }).finish());
    A.finishInit();
    aa();
  };
  const ca = async () => {
    const a = await y({
      tag: "iq",
      attrs: {
        id: `${v}${u++}`,
        xmlns: "encrypt",
        type: "get",
        to: WABinary_1.S_WHATSAPP_NET
      },
      content: [{
        tag: "count",
        attrs: {}
      }]
    });
    return +(0, WABinary_1.getBinaryNodeChild)(a, "count").attrs.value;
  };
  const Q = async (a = Defaults_1.INITIAL_PREKEY_COUNT) => {
    await C.transaction(async () => {
      e.info({
        count: a
      }, "uploading pre-keys");
      const {
        update: b,
        node: d
      } = await (0, Utils_1.getNextPreKeysNode)({
        creds: l,
        keys: C
      }, a);
      await y(d);
      k.emit("creds.update", b);
      e.info({
        count: a
      }, "uploaded pre-keys");
    });
  };
  const R = async () => {
    const a = await ca();
    e.info(`${a} pre-keys found on server`);
    if (a <= Defaults_1.MIN_PREKEY_COUNT) {
      await Q();
    }
  };
  const p = a => {
    if (O) {
      e.trace({
        trace: a?.stack
      }, "connection already closed");
    } else {
      O = true;
      e.info({
        trace: a?.stack
      }, a ? "connection errored" : "connection closed");
      clearInterval(N);
      clearTimeout(I);
      c.removeAllListeners("close");
      c.removeAllListeners("error");
      c.removeAllListeners("open");
      c.removeAllListeners("message");
      if (!c.isClosed && !c.isClosing) {
        try {
          c.close();
        } catch (b) {}
      }
      k.emit("connection.update", {
        connection: "close",
        lastDisconnect: {
          error: a,
          date: new Date()
        }
      });
      k.removeAllListeners("connection.update");
    }
  };
  const aa = () => N = setInterval(() => {
    H ||= new Date();
    if (Date.now() - H.getTime() > K + 5000) {
      p(new boom_1.Boom("Connection was lost", {
        statusCode: Types_1.DisconnectReason.connectionLost
      }));
    } else if (c.isOpen) {
      y({
        tag: "iq",
        attrs: {
          id: `${v}${u++}`,
          to: WABinary_1.S_WHATSAPP_NET,
          type: "get",
          xmlns: "w:p"
        },
        content: [{
          tag: "ping",
          attrs: {}
        }]
      }).catch(a => {
        e.error({
          trace: a.stack
        }, "error in sending keep alive");
      });
    } else {
      e.warn("keep alive called when WS not open");
    }
  }, K);
  c.on("message", a => {
    A.decodeFrame(a, b => {
      H = new Date();
      let f = false;
      f = c.emit("frame", b);
      if (!(b instanceof Uint8Array)) {
        const m = b.attrs.id;
        if (e.level === "trace") {
          e.trace({
            xml: (0, WABinary_1.binaryNodeToString)(b),
            msg: "recv xml"
          });
        }
        f = c.emit(`${Defaults_1.DEF_TAG_PREFIX}${m}`, b) || f;
        const n = b.tag;
        const q = b.attrs || {};
        const x = Array.isArray(b.content) ? b.content[0]?.tag : "";
        Object.keys(q).forEach(B => {
          f = c.emit(`${Defaults_1.DEF_CALLBACK_PREFIX}${n},${B}:${q[B]},${x}`, b) || f;
          f = c.emit(`${Defaults_1.DEF_CALLBACK_PREFIX}${n},${B}:${q[B]}`, b) || f;
          f = c.emit(`${Defaults_1.DEF_CALLBACK_PREFIX}${n},${B}`, b) || f;
        });
        f = c.emit(`${Defaults_1.DEF_CALLBACK_PREFIX}${n},,${x}`, b) || f;
        if (!(f = c.emit(`${Defaults_1.DEF_CALLBACK_PREFIX}${n}`, b) || f) && e.level === "debug") {
          e.debug({
            unhandled: true,
            msgId: m,
            fromMe: false,
            frame: b
          }, "communication recv");
        }
      }
    });
  });
  c.on("open", async () => {
    try {
      await ba();
    } catch (a) {
      e.error({
        err: a
      }, "error in validating connection");
      p(a);
    }
  });
  c.on("error", mapWebSocketError(p));
  c.on("close", () => p(new boom_1.Boom("Connection Terminated", {
    statusCode: Types_1.DisconnectReason.connectionClosed
  })));
  c.on("CB:xmlstreamend", () => p(new boom_1.Boom("Connection Terminated by Server", {
    statusCode: Types_1.DisconnectReason.connectionClosed
  })));
  c.on("CB:iq,type:set,pair-device", async a => {
    await w({
      tag: "iq",
      attrs: {
        to: WABinary_1.S_WHATSAPP_NET,
        type: "result",
        id: a.attrs.id
      }
    });
    a = (0, WABinary_1.getBinaryNodeChild)(a, "pair-device");
    const b = (0, WABinary_1.getBinaryNodeChildren)(a, "ref");
    const d = Buffer.from(l.noiseKey.public).toString("base64");
    const f = Buffer.from(l.signedIdentityKey.public).toString("base64");
    const m = l.advSecretKey;
    let n = L || 60000;
    const q = () => {
      if (c.isOpen) {
        var x = b.shift();
        if (x) {
          x = [x.content.toString("utf-8"), d, f, m].join();
          k.emit("connection.update", {
            qr: x
          });
          I = setTimeout(q, n);
          n = L || 20000;
        } else {
          p(new boom_1.Boom("QR refs attempts ended", {
            statusCode: Types_1.DisconnectReason.timedOut
          }));
        }
      }
    };
    q();
  });
  c.on("CB:iq,,pair-success", async a => {
    e.debug("pair success recv");
    try {
      const {
        reply: b,
        creds: d
      } = (0, Utils_1.configureSuccessfulPairing)(a, l);
      e.info({
        me: d.me,
        platform: d.platform
      }, "pairing configured successfully, expect to restart the connection...");
      k.emit("creds.update", d);
      k.emit("connection.update", {
        isNewLogin: true,
        qr: undefined
      });
      await w(b);
    } catch (b) {
      e.info({
        trace: b.stack
      }, "error in pairing");
      p(b);
    }
  });
  c.on("CB:success", async a => {
    await R();
    await y({
      tag: "iq",
      attrs: {
        to: WABinary_1.S_WHATSAPP_NET,
        xmlns: "passive",
        type: "set"
      },
      content: [{
        tag: "active",
        attrs: {}
      }]
    });
    e.info("opened connection to WA");
    clearTimeout(I);
    k.emit("creds.update", {
      me: {
        ...g.creds.me,
        lid: a.attrs.lid
      }
    });
    k.emit("connection.update", {
      connection: "open"
    });
  });
  c.on("CB:stream:error", a => {
    e.error({
      node: a
    }, "stream errored out");
    const {
      reason: b,
      statusCode: d
    } = (0, Utils_1.getErrorCodeFromStreamError)(a);
    p(new boom_1.Boom(`Stream Errored (${b})`, {
      statusCode: d,
      data: a
    }));
  });
  c.on("CB:failure", a => {
    p(new boom_1.Boom("Connection Failure", {
      statusCode: +(a.attrs.reason || 500),
      data: a.attrs
    }));
  });
  c.on("CB:ib,,downgrade_webclient", () => {
    p(new boom_1.Boom("Multi-device beta not joined", {
      statusCode: Types_1.DisconnectReason.multideviceMismatch
    }));
  });
  c.on("CB:ib,,edge_routing", a => {
    a = (0, WABinary_1.getBinaryNodeChild)(a, "edge_routing");
    a = (0, WABinary_1.getBinaryNodeChild)(a, "routing_info");
    if (a === null || a === undefined ? 0 : a.content) {
      g.creds.routingInfo = Buffer.from(a?.content);
    }
  });
  let S = false;
  process.nextTick(() => {
    var a;
    if ((a = l.me) === null || a === undefined ? 0 : a.id) {
      k.buffer();
      S = true;
    }
    k.emit("connection.update", {
      connection: "connecting",
      receivedPendingNotifications: false,
      qr: undefined
    });
  });
  c.on("CB:ib,,offline", a => {
    a = (0, WABinary_1.getBinaryNodeChild)(a, "offline");
    e.info(`handled ${+((a === null || a === undefined ? undefined : a.attrs.count) || 0)} offline messages/notifications`);
    if (S) {
      k.flush();
      e.trace("flushed events for initial buffer");
    }
    k.emit("connection.update", {
      receivedPendingNotifications: true
    });
  });
  k.on("creds.update", a => {
    const f = a.me?.name;
    if (l.me?.name !== f) {
      e.debug({
        name: f
      }, "updated pushName");
      w({
        tag: "presence",
        attrs: {
          name: f
        }
      }).catch(m => {
        e.warn({
          trace: m.stack
        }, "error in sending presence update on name change");
      });
    }
    Object.assign(l, a);
  });
  if (T) {
    (0, Utils_1.printQRIfNecessaryListener)(k, e);
  }
  return {
    type: "md",
    ws: c,
    ev: k,
    authState: {
      creds: l,
      keys: C
    },
    signalRepository: z,
    get user() {
      return g.creds.me;
    },
    generateMessageTag: () => `${v}${u++}`,
    query: y,
    waitForMessage: P,
    waitForSocketOpen: async () => {
      if (!c.isOpen) {
        if (c.isClosed || c.isClosing) {
          throw new boom_1.Boom("Connection Closed", {
            statusCode: Types_1.DisconnectReason.connectionClosed
          });
        }
        var a;
        var b;
        await new Promise((d, f) => {
          a = () => d(undefined);
          b = mapWebSocketError(f);
          c.on("open", a);
          c.on("close", b);
          c.on("error", b);
        }).finally(() => {
          c.off("open", a);
          c.off("close", b);
          c.off("error", b);
        });
      }
    },
    sendRawMessage: D,
    sendNode: w,
    logout: async a => {
      const d = g.creds.me?.id;
      if (d) {
        await w({
          tag: "iq",
          attrs: {
            to: WABinary_1.S_WHATSAPP_NET,
            type: "set",
            id: `${v}${u++}`,
            xmlns: "md"
          },
          content: [{
            tag: "remove-companion-device",
            attrs: {
              jid: d,
              reason: "user_initiated"
            }
          }]
        });
      }
      p(new boom_1.Boom(a || "Intentional Logout", {
        statusCode: Types_1.DisconnectReason.loggedOut
      }));
    },
    end: p,
    onUnexpectedError: (a, b) => {
      e.error({
        err: a
      }, `unexpected error in '${b}'`);
    },
    uploadPreKeys: Q,
    uploadPreKeysToServerIfRequired: R,
    requestPairingCode: async (a, b = null) => {
      g.creds.pairingCode = b ? b.toUpperCase() : (0, Utils_1.bytesToCrockford)((0, crypto_1.randomBytes)(5));

      g.creds.me = {
        id: (0, WABinary_1.jidEncode)(a, "s.whatsapp.net"),
        name: "~"
      };
      k.emit("creds.update", g.creds);
      await w({
        tag: "iq",
        attrs: {
          to: WABinary_1.S_WHATSAPP_NET,
          type: "set",
          id: `${v}${u++}`,
          xmlns: "md"
        },
        content: [{
          tag: "link_code_companion_reg",
          attrs: {
            jid: g.creds.me.id,
            stage: "companion_hello",
            should_show_push_notification: "true"
          },
          content: [{
            tag: "link_code_pairing_wrapped_companion_ephemeral_pub",
            attrs: {},
            content: await r()
          }, {
            tag: "companion_server_auth_key_pub",
            attrs: {},
            content: g.creds.noiseKey.public
          }, {
            tag: "companion_platform_id",
            attrs: {},
            content: "49"
          }, {
            tag: "companion_platform_display",
            attrs: {},
            content: `${G[1]} (${G[0]})`
          }, {
            tag: "link_code_pairing_nonce",
            attrs: {},
            content: "0"
          }]
        }]
      });
      return g.creds.pairingCode;
    },
    waitForConnectionUpdate: (0, Utils_1.bindWaitForConnectionUpdate)(k),
    sendWAMBuffer: a => y({
      tag: "iq",
      attrs: {
        to: WABinary_1.S_WHATSAPP_NET,
        id: `${v}${u++}`,
        xmlns: "w:stats"
      },
      content: [{
        tag: "add",
        attrs: {},
        content: a
      }]
    })
  };
};
exports.makeSocket = makeSocket;
function mapWebSocketError(h) {
  return r => {
    h(new boom_1.Boom(`WebSocket Error (${r?.message})`, {
      statusCode: (0, Utils_1.getCodeFromWSError)(r),
      data: r
    }));
  };
}
;