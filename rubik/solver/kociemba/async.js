(function() {
  var KCube, Extend, key, value;

  KCube = this.KCube || require('./cube');

  Extend = {
    asyncOK: !!window.Worker,
    _asyncSetup: function(workerURI) {
      if (this._worker) {
        return;
      }
      this._worker = new window.Worker(workerURI);
      this._worker.addEventListener('message', (e) => {
        return this._asyncEvent(e);
      });
      return this._asyncCallbacks = {};
    },
    _asyncEvent: function(e) {
      var callback, callbacks;
      callbacks = this._asyncCallbacks[e.data.cmd];
      if (!(callbacks && callbacks.length)) {
        return;
      }
      callback = callbacks[0];
      callbacks.splice(0, 1);
      return callback(e.data);
    },
    _asyncCallback: function(cmd, callback) {
      var base;
      (base = this._asyncCallbacks)[cmd] || (base[cmd] = []);
      return this._asyncCallbacks[cmd].push(callback);
    },
    asyncInit: function(workerURI, callback) {
      this._asyncSetup(workerURI);
      this._asyncCallback('init', callback);
      return this._worker.postMessage({
        cmd: 'init'
      });
    },
    asyncSolve: function(cube, steps, callback) {
      this._asyncSetup();
      this._asyncCallback('solve', function(data) {
        return callback(data.algorithm);
      });

      return this._worker.postMessage({
        cmd: 'solve',
        cube: cube.toJSON(),
        steps: steps
      });
    },
    asyncScramble: function(callback) {
      this._asyncSetup();
      this._asyncCallback('solve', function(data) {
        return callback(KCube.inverse(data.algorithm));
      });
      return this._worker.postMessage({
        cmd: 'solve',
        cube: KCube.random().toJSON()
      });
    }
  };

  for (key in Extend) {
    value = Extend[key];
    KCube[key] = value;
  }

}).call(this);