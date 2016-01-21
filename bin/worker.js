var express = require('express');

module.exports.run = function(worker) {
  var app = require('express')();
  var httpServer = worker.httpServer;
  var scServer = worker.scServer;

  httpServer.on('request', app);
  app.get('/', function(req, res) {
    res.send('<html><body>' +
      '<p>It works! Now point your app and monitor app to connect to this server.</p>' +
      '</body></html>');
  });

  scServer.addMiddleware(scServer.MIDDLEWARE_EMIT, function (socket, channel, data, next) {
    if (channel.substr(0, 3) === 'sc-' || channel === 'respond' || channel === 'log') {
      scServer.exchange.publish(channel, data);
    } else if (channel === 'log-noid') {
      scServer.exchange.publish('log', { id: socket.id, data: data });
    }
    next();
  });

  scServer.on('connection', function(socket) {
    socket.on('login', function (credentials, respond) {
      var channelName = credentials === 'master' ? 'respond' : 'log';
      worker.exchange.subscribe('sc-' + socket.id).watch(function(msg) {
        socket.emit(channelName, msg);
      });
      respond(null, channelName);
    });
    socket.on('disconnect', function() {
      var channel = worker.exchange.channel('sc-' + socket.id);
      channel.unsubscribe(); channel.destroy();
      scServer.exchange.publish('log', { id: socket.id, type: 'DISCONNECTED' });
    });
  });
};