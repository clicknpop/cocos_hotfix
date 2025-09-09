/**
 * 熱更提示
 * @summary 介面用
 */
export interface HotfixHint {
    /**
     * 檢查是否需要熱更時發生錯誤
     * @param code 錯誤碼
     */
    onCheckErr(code: number): void;

    /**
     * 檢查是否需要熱更完畢
     * @param res 是否需要熱更
     * @param bytes 熱更總量
     */
    onChecked(res: boolean, bytes: number): void;

    /**
     * 熱更開始
     * @param files 需下載文件數
     * @param bytes 需下載總量
     */
    onUpdateStart(files: number, bytes: number): void;

    /**
     * 熱更中
     * @param files 已完成文件數
     * @param bytes 已完成總量
     * @param name 更新的檔案名
     */
    onUpdating(files: number, bytes: number, name?: string): void;

    /**
     * 熱更時發生錯誤
     * @param code 錯誤碼
     * @param res 錯誤原因
     * @param assetID 發生錯誤的資源名稱
     */
    onUpdateErr(code: number, res?: string, assetID?: string): void;

    /**
     * 熱更完成
     * @returns 經過此時間後將進行重啟
     */
    onUpdated(): Promise<number>;
}
