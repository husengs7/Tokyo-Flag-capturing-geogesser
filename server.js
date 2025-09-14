// Express サーバーのエントリーポイント（ルーティング、ミドルウェア、静的ファイル提供）
const express = require('express');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const path = require('path');
const http = require('http');
const passport = require('./config/passport');
const connectDB = require('./config/database');
const { initializeSocket } = require('./config/socket');

if (process.env.NODE_ENV !== 'production') {
    require('dotenv').config();
}

// ルーター読み込み
const indexRouter = require('./routes/index');
const apiRouter = require('./routes/game');
const authRouter = require('./routes/auth');
const multiRouter = require('./routes/multi');

// データベース接続
connectDB();

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;

// Socket.io初期化
const io = initializeSocket(server);

// セッション設定
app.use(session({
    secret: process.env.SESSION_SECRET || 'tokyo-geoguess-secret-key',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
        mongoUrl: process.env.MONGODB_URI || 'mongodb://localhost:27017/tokyo-geoguess'
    }),
    cookie: {
        secure: false, // HTTPSでない場合はfalse
        httpOnly: true, // XSSに対するセキュリティ向上
        maxAge: 1000 * 60 * 60 * 24 // 24時間
    }
}));

// ミドルウェア
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Passport認証初期化
app.use(passport.initialize());
app.use(passport.session());

// 静的ファイル提供
app.use(express.static(path.join(__dirname, 'public')));

// ルーター使用
app.use('/', indexRouter);
app.use('/api', apiRouter);
app.use('/auth', authRouter);
app.use('/multi', multiRouter);

server.listen(PORT, () => {
    console.log(`サーバーが http://localhost:${PORT} で起動しています`);
    console.log(`Socket.io サーバーも同時に起動しました`);
});

module.exports = app;