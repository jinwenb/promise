const PENDING = 'pending';//初始态
const FULFILLED = 'fulfilled';//初始态
const REJECTED = 'rejected';//初始态
function Promise(executor) {
    let self = this;//先缓存当前promise实例
    self.status = PENDING;//设置状态
    //定义存放成功的回调的数组
    self.onResolvedCallbacks = [];
    //定义存放失败回调的数组
    self.onRejectedCallbacks = [];

    //当调用此方法的时候，如果promise状态为pending,的话可以转成成功态,如果已经是成功态或者失败态了，则什么都不做
    function resolve(value) {
        if (self.status == PENDING) {
            self.status = FULFILLED;
            self.value = value;//成功后会得到一个值，这个值不能改
            //调用所有成功的回调
            self.onResolvedCallbacks.forEach(cb => cb(self.value));
        }
    }

    function reject(reason) {
        //如果是初始态，则转成失败态
        if (self.status == PENDING) {
            self.status = REJECTED;
            self.value = reason;//失败的原因给了value
            self.onRejectedCallbacks.forEach(cb => cb(self.value));
        }

    }

    try {
        //因为此函数执行可能会异常，所以需要捕获，如果出错了，需要用错误 对象reject
        executor(resolve, reject);
    } catch (e) {
        //如果这函数执行失败了，则用失败的原因reject这个promise
        reject(e);
    }
    ;
}

//先看 then方法 在看这个方法
function resolvePromise(promise2, x, resolve, reject) {
    //例子  let p = new Promise((resolve,reject)=>{resolve(100)})
    // p.then(()=>{return p});
    if (promise2 === x) {
        return reject(new TypeError('循环引用'))
    }
    let called;
    if (x != null && (Object.prototype.toString.call(x) === '[object Object]' || typeof x === 'function')) {
        // 比如用数据劫持定义的get方法里报错那么将会进入到catch
        try {
            let then = x.then;
            if (typeof then === 'function') {
                //这时候说明then是个函数 then.call把 then里面的this变成
                //这里是为了和别人的 promises 交互
                then.call(x, function (y) {
                    //一个标识符只允许 要么resolve,要么 reject
                    if (called) return;
                    called = true;
                    //这里成功了但是可能会
                    //then(()=>{return new Promises})
                    //  里面又是 Promises实列
                    //所以再走解析
                    resolvePromise(promise2, y, resolve, reject)
                }, function (y) {
                    if (called) return;
                    called = true;
                    reject(y);
                })
            } else {
                //这个时候是个普通值
                resolve(x)
            }
        } catch (e) {
            if (called) return;
            called = true;
            //错误将会传到reject
            reject(e)
        }
    }
    else {
        resolve(x);
    }
}

Promise.prototype.then = function (onFulfilled, onRejected) {
//判断是不是一个函数如果是这样
    onFulfilled = typeof onFulfilled === 'function' ? onFulfilled : function (value) {
        return value
    };
    onRejected = typeof onRejected === 'function' ? onRejected : reason => {
        throw reason
    };
    //如果当前promise状态已经是成功态了，onFulfilled直接取值
    let self = this;
    let promise2;
    //因为要进行链式编程 所以返回了一个实例对象
    if (self.status === FULFILLED) {
        //这时候说明 FULFILLED 并不是异步操作，直接成功
        return promise2 = new Promise(function (resolve, reject) {
            setTimeout(function () {
                //  成功了也要try
                /*
                * 比如 实例.then(function(value){
                * 这时候失败原因将 传入到下一次的then的 onRejected
                * 下一次的then 实际上是promise2.then()
                * throw Error()
                * })
                * */
                try {
                    // 这里会出现2种情况
                    //
                    // 1. 实例.then(function(value){
                    //    return new Promise()
                    //   },function(){
                    // }
                    // )
                    //
                    // 2. 实例.then(function(value){
                    //   console.log(value)
                    //   },function(){
                    //  }
                    // )
                    let x = onFulfilled(self.value);
                    //第一个情况  x 又是一个 promises
                    //第2个情况  就无关紧要了
                    //如果又是promises 对象 将会解析里面的 onFulfilled 值 传进
                    // 下一次 的  onFulfilled 也就是  promise2.then((返回的promise值)=>{})
                    // 那么既然可能又是 promises 对象 将走解析
                    resolvePromise(promise2, x, resolve, reject)
                } catch (e) {
                    reject(e)
                }
            })


        })
    }
    if (self.status === REJECTED) {
        return promise2 = new Promise(function (resolve, reject) {
            setTimeout(function () {
                try {
                    //失败了也 try
                    // 比如
                    // 实列.then(()=>{},()=>{这里面成功了也将会传到下一次的then里面})
                    let x = onRejected(self.value);
                    // 那么既然可能又是 promises 对象 将走解析
                    resolvePromise(promise2, x, resolve, reject)
                } catch (e) {
                    reject(e);
                }
            })


        })
    }

    if (this.status === PENDING) {
        //这是时候 如上面 构造函数中所说 对方传入了一个异步操作
        return promise2 = new Promise(function (resolve, reject) {
            //这个value就是上面构造函数里的值
            self.onResolvedCallbacks.push(function () {
                setTimeout(function () {
                    try {
                        let x = onFulfilled(self.value);
                        // 那么既然可能又是 promises 对象 将走解析
                        resolvePromise(promise2, x, resolve, reject)
                    } catch (e) {
                        reject(e);
                    }
                })
            });
            self.onRejectedCallbacks.push(function () {
                setTimeout(function () {
                    try {
                        let x = onRejected(self.value);
                        // 那么既然可能又是 promises 对象 将走解析
                        resolvePromise(promise2, x, resolve, reject)
                    } catch (e) {
                        reject(e);
                    }
                })
            });
        })
    }
};
//测试重力 可以忽略

Promise.deferred = Promise.defer = function () {
    let defer = {};
    defer.promise = new Promise(function (resolve, reject) {
        defer.resolve = resolve;
        defer.reject = reject;
    });
    return defer;
}

//promises-aplus-tests
module.exports = Promise;

