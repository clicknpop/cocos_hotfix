import { Asset, game, native, resources } from "cc";
import { NATIVE } from "cc/env";
import * as sparkMD5 from "spark-md5"
import { HotfixHint } from "./hotfix_hint";

/**
 * 熱更管理
 */
export class HotfixMgr {
    /**
     * 本地manifest路徑
     * @summary 從resources中加載
     */
    private static readonly _MANIFEST_PATH = `project`;

    /**
     * 資源存放資料夾
     * @summary 從遠端下載回來的資源, 將會存在native的此資料夾
     */
    private static readonly _STORAGE_FOLDER = 'hotfix_assets';

    /**
     * 資源存放位置
     * @summary 從遠端下載回來的資源, 將會存在native的此位置
     */
    private _storagePath: string = '/' + HotfixMgr._STORAGE_FOLDER;

    /**
     * native資源管理
     */
    private _am: native.AssetsManager = null;
    
    /**
     * 是否可啟用熱更
     */
    get enable(): boolean { return NATIVE && !native.fileUtils; };

    /**
     * 熱更提示
     */
    private _hint: HotfixHint = null;

    /**
     * 是否在執行業務中
     */
    private _isWorking: boolean = false;

    /**
     * 關閉
     */
    shutdown(): void {
        this._hint = null;
        this._isWorking = false;

        this._am?.setEventCallback(null);
        this._am?.setVerifyCallback(null);
        this._am = null;
    }

    /**
     * 初始化
     * @param hint 熱更提示
     */
    async init(hint: HotfixHint): Promise<void> {
        if (!this.enable) {
            console.warn('hotfix init failed, wrong env.');
            return;
        }

        if (this._isWorking) {
            console.warn(`hotfix init failed, it's working.`);
            return;
        }

        // 存儲路徑
        let path = native.fileUtils ? native.fileUtils.getWritablePath() : '/';
        this._storagePath = path + HotfixMgr._STORAGE_FOLDER;
        console.log('hotfix storage path.', this._storagePath);

        // native資源管理
        let url = await this.loadManifest();
        this.initAM(url);

        this._hint = hint;
        this._isWorking = false;
    }

    /**
     * 加載manifest
     * @returns 文件在native的url
     */
    private async loadManifest(): Promise<string> {
        return new Promise((resolve, reject) => {
            console.log('hotfix load local manifest.', HotfixMgr._MANIFEST_PATH);
            
            resources.load(HotfixMgr._MANIFEST_PATH, Asset, (err, asset) => {
                if (err) {
                    console.error('hotfix load local manifest failed.', err);
                    reject(err);
                }

                console.log('hotfix load local manifest done.', asset.nativeUrl);
                resolve(asset.nativeUrl);
            });
        });
    }

    /**
     * 初始化native資源管理
     * @param url 文件在native的url
     */
    private initAM(url: string): void {
        console.log('hotfix init am.', url, this._storagePath);

        this._am = new native.AssetsManager(url, this._storagePath, (verA, verB) => {
            console.log(`hotfix compare ver.`, verA, verB);
            return this.compareVer(verA, verB);
        });

        this._am.setVerifyCallback(this.onVerifyAsset.bind(this));
        this._am.setEventCallback(null);  // 依照種類另外設置

        console.log(`hotfix init am done.`);
    }

    /**
	 * 比對版本 
	 * @returns 0 版本a等於版本b
	 * @returns 1 版本a大於版本b
	 * @returns -1 版本a小於版本 
	 */
	private compareVer(verA: string, verB: string): number {
		let listA = verA.split('.');
		let listB = verB.split('.');

		for (let i = 0; i < listA.length; i++) {
			let numA = parseInt(listA[i]) || 0;
			let numB = parseInt(listB[i] || '0') || 0;

			if (numA == numB) {
				continue;
			}

			return numA - numB;
		}

		return verB.length > verA.length ? -1 : 0;
	}

    /**
	 * 驗證資源
	 * @param path 資源路徑(絕對路徑)
	 * @param asset 資源對象
	 * @summary 是否通過驗證
	 */
	private onVerifyAsset(path: string, asset: any): boolean {
		let compressed = asset.compressed;
		let relative = asset.path;  // 相對路徑

		// 壓縮文件, 不檢查md5
		if (compressed) {
			console.log(`hotfix verify asset passed, it's compressed.`, relative);
			return true;
		}

		let localMD5 = sparkMD5['default'].ArrayBuffer.hash(native.fileUtils.getDataFromFile(path));

		if (asset.md5 == localMD5) {
			console.info(`hotfix verify asset passed.`, relative, localMD5);
			return true;
		}

		console.info(`hotfix verify asset failed.`, relative, localMD5, asset.md5);
		return false;
	}

    /**
     * 檢查是否需要熱更
     */
    checkUpdate(): void {
        if (!this.enable) {
            console.warn('hotfix check update failed, wrong env.');
            return;
        }

        if (!this._am) {
            console.error('hotfix check update failed, am is null.');
            return;
        }

        if (this._isWorking) {
            console.warn(`hotfix check update failed, it's working.`);
            return;
        }

        this._isWorking = true;
        this._am.setEventCallback(this.onCheckEvent.bind(this));
        this._am.checkUpdate();
    }

    /**
     * 檢查熱更事件
     */
    private onCheckEvent(event: any): void {
        let code = event.getEventCode();
        console.log('hotfix on check event.', code);

        switch (code) {
            // 發現新版本
            case native.EventAssetsManager.NEW_VERSION_FOUND:
                this._hint?.onChecked(true, this._am.getTotalBytes());
                break;

            // 已經是最新版
            case native.EventAssetsManager.ALREADY_UP_TO_DATE:
                this._hint?.onChecked(false, 0);
                break;

            // 其他
            default:
                this._hint?.onCheckErr(code);
                break;
        }

        // 清空
        this._am.setEventCallback(null);
        this._isWorking = false;
    }

    /**
     * 開始熱更
     */
    startUpdate(): void {
        if (!this.enable) {
            console.warn('hotfix start update failed, wrong env.');
            return;
        }

        if (!this._am) {
            console.error('hotfix start update failed, am is null.');
            return;
        }

        if (this._isWorking) {
            console.warn(`hotfix start update failed, it's working.`);
            return;
        }

        this._hint?.onUpdateStart(this._am.getTotalFiles(), this._am.getTotalBytes());

        this._isWorking = true;
        this._am.setEventCallback(this.onUpdateEvent.bind(this));
        this._am.update();
    }

    /**
     * 熱更中事件
     */
    private onUpdateEvent(event: any): void {
        let code = event.getEventCode();

        // 防洗頻
        if (code != native.EventAssetsManager.UPDATE_PROGRESSION) {
            console.log('hotfix on update event.', code);
        }

        let isFailed = true;
        let isReboot = false;

        switch (code) {
            // 更新中
            case native.EventAssetsManager.UPDATE_PROGRESSION:
                this._hint?.onUpdating(event.getDownloadedFiles(), 
                                       event.getDownloadedBytes(), 
                                       event.getMessage());

                isFailed = false;
                break;

            // 更新完成
            case native.EventAssetsManager.UPDATE_FINISHED:
                this._hint?.onUpdated();
                isReboot = true;
                break;

            // 其他
            default:
                this._hint?.onUpdateErr(code, event.getMessage(), event.getAssetId());
                break;
        }

        // 清空
        if (isFailed || isReboot) {
            this._am.setEventCallback(null);
            this._isWorking = false;
        }

        // 重開
        if (isReboot) {
            let searchPaths = native.fileUtils.getSearchPaths();
			let newPaths = this._am?.getLocalManifest().getSearchPaths();

            console.log(`hotfix new paths.`, newPaths);

            // 添加到數組開頭
			if (newPaths && newPaths.length > 0) {
				searchPaths.unshift(...newPaths);
            }

            // 添加到local save中, 這樣main.js才會在啟動時, 拿本地新值比對遠端
			localStorage.setItem('HotUpdateSearchPaths', JSON.stringify(searchPaths));
            native.fileUtils.setSearchPaths(searchPaths);

            // 倒數
            window.setTimeout(() => {
				this.shutdown();
				game.restart();
			}, 1000);
        }
    }
}
