// Passport認証設定
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const User = require('../models/User');

// passport-local-mongooseが提供する認証システムを使用
passport.use(new LocalStrategy(User.authenticate()));

// セッション管理のためのシリアライズ/デシリアライズ
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

module.exports = passport;