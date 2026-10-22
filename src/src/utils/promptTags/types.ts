import { IPromptOptionValueRecordWithLegacy } from '../promptOptions/definitions';

/**
 * 產生 prompt 所需的選項集合。
 */
export type IHostPromptOptions = Partial<IPromptOptionValueRecordWithLegacy> & {
	/**
	 * loadExtraNetworks() 是否已呼叫過（App data 的同名鏡像 prop）。
	 * genPromptCore 據此只在尚未載入時，於首次輸出 extra networks tag 時要求載入。
	 */
	requestLoadExtraNetworksCalled?: boolean;
}
