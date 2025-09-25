// ルーム操作管理サービス（ルーム作成、参加、管理）
const Room = require('../models/Room');
const User = require('../models/User');

class RoomService {

    /**
     * 新しいルームを作成
     * @param {string} hostId - ホストのユーザーID
     * @param {Object} settings - ルーム設定（オプション）
     * @returns {Promise<Room>} 作成されたルーム
     */
    static async createRoom(hostId, settings = {}) {
        try {
            // ホストユーザーの存在確認
            const host = await User.findById(hostId);
            if (!host) {
                throw new Error('ホストユーザーが見つかりません');
            }

            // 新しいルーム作成前に、このユーザーの古いルームから退出
            await this.leaveAllUserRooms(hostId);

            // ルーム作成（roomKeyはpre-saveフックで自動生成）
            const room = new Room({
                hostId: hostId,
                settings: {
                    maxPlayers: settings.maxPlayers || 4,
                    roundCount: settings.roundCount || 3
                }
                // gameStateは実際のゲーム開始時に設定される
            });

            // ホストをプレイヤーとして追加
            await room.addPlayer(hostId, host.username, true);

            return room;
        } catch (error) {
            console.error('ルーム作成エラー:', error);
            throw error;
        }
    }

    /**
     * ルームキーでルームに参加
     * @param {string} roomKey - 6桁のルームキー
     * @param {string} userId - 参加するユーザーID
     * @returns {Promise<Room>} 参加したルーム
     */
    static async joinRoom(roomKey, userId) {
        try {
            console.log(`[DEBUG] ルーム参加処理開始: ユーザー=${userId}, ルームキー=${roomKey}`);

            // ユーザーの存在確認
            const user = await User.findById(userId);
            if (!user) {
                throw new Error('ユーザーが見つかりません');
            }

            // ルームの存在確認
            let room = await Room.findOne({ roomKey });
            if (!room) {
                throw new Error('ルームが見つかりません');
            }

            console.log(`[DEBUG] 対象ルーム: ${room._id}, 現在のプレイヤー数: ${room.players.length}`);

            // ルーム状態チェック（待機中のみ参加可能）
            if (room.status !== 'waiting') {
                throw new Error('このルームは現在参加できません');
            }

            // このユーザーが参加している全ルームを確認（デバッグ用）
            const userRooms = await Room.find({
                $or: [
                    { hostId: userId },
                    { 'players.userId': userId }
                ],
                status: { $in: ['waiting', 'playing', 'ranking'] }
            });
            console.log(`[DEBUG] 参加前のユーザー関連ルーム数: ${userRooms.length}`);

            // 新しいルーム参加前に、このユーザーの古いルームから退出（参加対象ルームは除外）
            // 注意：バリデーションはクリーンアップ後に行う
            await this.leaveAllUserRooms(userId, room._id);

            // クリーンアップ後にルームを再取得（データベースの最新状態を反映）
            room = await Room.findOne({ roomKey });
            if (!room) {
                throw new Error('ルームが見つかりません');
            }

            console.log(`[DEBUG] クリーンアップ後のルーム状態確認完了`);

            // ルームに参加
            await room.addPlayer(userId, user.username);

            console.log(`[DEBUG] ルーム参加成功: ${room._id}`);
            return room;
        } catch (error) {
            console.error('ルーム参加エラー:', error);
            throw error;
        }
    }

    /**
     * ルームから退出
     * @param {string} roomId - ルームID
     * @param {string} userId - 退出するユーザーID
     * @returns {Promise<Room|null>} 更新されたルーム（解散された場合はnull）
     */
    static async leaveRoom(roomId, userId) {
        try {
            const room = await Room.findById(roomId);
            if (!room) {
                throw new Error('ルームが見つかりません');
            }

            // プレイヤーの存在確認
            const player = room.players.find(p => p.userId.toString() === userId.toString());
            if (!player) {
                throw new Error('このルームに参加していません');
            }

            // プレイヤーを削除
            await room.removePlayer(userId);

            // 全員が退出した場合はルームを削除
            if (room.players.length === 0) {
                await Room.findByIdAndDelete(roomId);
                return null;
            }

            return room;
        } catch (error) {
            console.error('ルーム退出エラー:', error);
            throw error;
        }
    }

    /**
     * プレイヤーの準備状態を切り替え
     * @param {string} roomId - ルームID
     * @param {string} userId - ユーザーID
     * @param {boolean} isReady - 準備状態
     * @returns {Promise<Room>} 更新されたルーム
     */
    static async setPlayerReady(roomId, userId, isReady = true) {
        try {
            const room = await Room.findById(roomId);
            if (!room) {
                throw new Error('ルームが見つかりません');
            }

            // プレイヤー検索
            const player = room.players.find(p => p.userId.toString() === userId.toString());
            if (!player) {
                throw new Error('このルームに参加していません');
            }

            // 準備状態を更新
            player.isReady = isReady;
            await room.save();

            return room;
        } catch (error) {
            console.error('準備状態更新エラー:', error);
            throw error;
        }
    }

    /**
     * ルーム情報を取得
     * @param {string} roomId - ルームID
     * @returns {Promise<Room>} ルーム情報
     */
    static async getRoomInfo(roomId) {
        try {
            const room = await Room.findById(roomId)
                .populate('hostId', 'username')
                .populate('players.userId', 'username');

            if (!room) {
                throw new Error('ルームが見つかりません');
            }

            return room;
        } catch (error) {
            console.error('ルーム情報取得エラー:', error);
            throw error;
        }
    }

    /**
     * ルームキーでルーム情報を取得
     * @param {string} roomKey - ルームキー
     * @returns {Promise<Room>} ルーム情報
     */
    static async getRoomByKey(roomKey) {
        try {
            const room = await Room.findOne({ roomKey })
                .populate('hostId', 'username')
                .populate('players.userId', 'username');

            if (!room) {
                throw new Error('ルームが見つかりません');
            }

            return room;
        } catch (error) {
            console.error('ルーム情報取得エラー:', error);
            throw error;
        }
    }

    /**
     * プレイヤーの現在位置を更新
     * @param {string} roomId - ルームID
     * @param {string} userId - ユーザーID
     * @param {number} lat - 緯度
     * @param {number} lng - 経度
     * @returns {Promise<Room>} 更新されたルーム
     */
    static async updatePlayerPosition(roomId, userId, lat, lng) {
        try {
            const room = await Room.findById(roomId);
            if (!room) {
                throw new Error('ルームが見つかりません');
            }

            // プレイヤー検索
            const player = room.players.find(p => p.userId.toString() === userId.toString());
            if (!player) {
                throw new Error('このルームに参加していません');
            }

            // 位置情報を更新
            player.currentPosition = {
                lat,
                lng,
                timestamp: new Date()
            };

            await room.save();
            return room;
        } catch (error) {
            console.error('位置情報更新エラー:', error);
            throw error;
        }
    }

    /**
     * プレイヤーの推測完了状態を設定
     * @param {string} roomId - ルームID
     * @param {string} userId - ユーザーID
     * @param {boolean} hasGuessed - 推測完了状態
     * @returns {Promise<Room>} 更新されたルーム
     */
    static async setPlayerGuessed(roomId, userId, hasGuessed = true) {
        try {
            const room = await Room.findById(roomId);
            if (!room) {
                throw new Error('ルームが見つかりません');
            }

            // プレイヤー検索
            const player = room.players.find(p => p.userId.toString() === userId.toString());
            if (!player) {
                throw new Error('このルームに参加していません');
            }

            // 推測状態を更新
            player.hasGuessed = hasGuessed;

            // 全員が推測完了したかチェック
            if (room.allPlayersGuessed()) {
                if (!room.gameState) {
                    room.gameState = {
                        targetLocation: { lat: 35.6762, lng: 139.6503 },
                        playerStartLocation: { lat: 35.6896, lng: 139.7006 },
                        initialDistance: 1000
                    };
                }
                room.gameState.allPlayersGuessed = true;
                room.status = 'ranking';
                // 5秒後にランキング表示終了
                room.gameState.rankingDisplayUntil = new Date(Date.now() + 5000);
            }

            await room.save();
            return room;
        } catch (error) {
            console.error('推測状態更新エラー:', error);
            throw error;
        }
    }

    /**
     * 指定ユーザーが参加している全てのアクティブルームから退出
     * @param {string} userId - ユーザーID
     * @param {string} excludeRoomId - 退出対象から除外するルームID（オプション）
     * @returns {Promise<void>}
     */
    static async leaveAllUserRooms(userId, excludeRoomId = null) {
        try {
            // このユーザーが参加している全てのアクティブルームを取得
            const query = {
                $or: [
                    { hostId: userId },
                    { 'players.userId': userId }
                ],
                status: { $in: ['waiting', 'playing', 'ranking'] }
            };

            // 除外するルームがある場合は条件に追加
            if (excludeRoomId) {
                query._id = { $ne: excludeRoomId };
            }

            const userRooms = await Room.find(query);

            if (userRooms.length > 0) {
                console.log(`ユーザー ${userId} の ${userRooms.length} 個のアクティブルームから退出処理を開始`);

                // 各ルームから退出
                for (const room of userRooms) {
                    try {
                        await this.leaveRoom(room._id, userId);
                        console.log(`ルーム ${room.roomKey} から退出完了`);
                    } catch (error) {
                        console.log(`ルーム ${room.roomKey} からの退出をスキップ: ${error.message}`);
                        // 退出エラーは無視して続行（既に削除済み等）
                    }
                }

                console.log(`ユーザー ${userId} の全ルーム退出処理完了`);
            }
        } catch (error) {
            console.error('全ルーム退出エラー:', error);
            // エラーが発生しても新しいルーム作成は続行
        }
    }

    /**
     * アクティブなルーム一覧を取得（開発用）
     * @returns {Promise<Room[]>} アクティブなルーム一覧
     */
    static async getActiveRooms() {
        try {
            return await Room.find({
                status: { $in: ['waiting', 'playing', 'ranking'] }
            })
                .populate('hostId', 'username')
                .sort({ createdAt: -1 });
        } catch (error) {
            console.error('アクティブルーム取得エラー:', error);
            throw error;
        }
    }

    /**
     * 古いルームを自動削除（クリーンアップ処理）
     * @param {number} hoursOld - 指定時間以上古いルームを削除（デフォルト: 24時間）
     * @returns {Promise<number>} 削除されたルーム数
     */
    static async cleanupOldRooms(hoursOld = 24) {
        try {
            const cutoffTime = new Date(Date.now() - hoursOld * 60 * 60 * 1000);

            const result = await Room.deleteMany({
                $or: [
                    { status: 'finished', updatedAt: { $lt: cutoffTime } },
                    { createdAt: { $lt: cutoffTime } }
                ]
            });

            console.log(`${result.deletedCount}個の古いルームを削除しました`);
            return result.deletedCount;
        } catch (error) {
            console.error('ルームクリーンアップエラー:', error);
            throw error;
        }
    }
}

module.exports = RoomService;