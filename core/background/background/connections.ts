import type { AppConnection, ContentWalletData, StreamResponse } from "types";
import type { BackgroundState } from "./state";
import type { BaseError } from "lib/error";

import { MTypeTab } from "config/stream-keys";
import { PromptService } from "lib/prompt";
import { TabsMessage } from "lib/stream/tabs-message";


export class BackgroundConnection {
  readonly #core: BackgroundState;

  constructor(state: BackgroundState) {
    this.#core = state;
  }

  async getConnections(sendResponse: StreamResponse) {
    try {
      this.#core.guard.checkSession();

      return sendResponse({
        resolve: this.#core.connections.identities
      });
    } catch (err) {
      return sendResponse({
        reject: (err as BaseError).serialize()
      });
    }
  }

  async removeConnections(index: number, sendResponse: StreamResponse) {
    try {
      this.#core.guard.checkSession();

      await this.#core.connections.rm(index);

      return sendResponse({
        resolve: this.#core.connections.identities
      });
    } catch (err) {
      return sendResponse({
        reject: (err as BaseError).serialize()
      });
    }
  }

  async approveConnections(index: number, sendResponse: StreamResponse) {
    try {
      this.#core.guard.checkSession();

      const connection = this.#core.connections.confirm[index];

      await this.#core.connections.add(connection);
      await this.#core.connections.removeConfirmConnection(index);

      return sendResponse({
        resolve: this.#core.state
      });
    } catch (err) {
      return sendResponse({
        reject: (err as BaseError).serialize()
      });
    }
  }

  async rejectConnections(index: number, sendResponse: StreamResponse) {
    try {
      this.#core.guard.checkSession();

      await this.#core.connections.removeConfirmConnection(index);

      return sendResponse({
        resolve: this.#core.state
      });
    } catch (err) {
      return sendResponse({
        reject: (err as BaseError).serialize()
      });
    }
  }

  async resolveContentData(domain: string, sendResponse: StreamResponse) {
    const enabled = this.#core.guard.isEnable;
    const connected = this.#core.connections.has(domain);
    const account = this.#core.account.selectedAccount;
    const base58 = (connected && enabled && account) ? account.base58 : undefined;
    const providers = connected ? this.#core.netwrok.providers : [];
    const net = connected ? this.#core.netwrok.selected : undefined;

    const data: ContentWalletData = {
      base58,
      connected,
      enabled,
      providers,
      net,
      phishing: this.#core.settings.phishing.phishingDetectionEnabled,
      smartRequest: this.#core.settings.network.downgrade
    };
    return sendResponse({
      resolve: data
    });
  }

  async addConnectAppConfirm(app: AppConnection, sendResponse: StreamResponse) {
    try {
      const prompt = new PromptService(this.#core.settings.popup.enabledPopup);

      await this.#core.connections.addAppFroConfirm(app);
      await prompt.open();

      return sendResponse({
        resolve: true
      });
    } catch (err) {
      new TabsMessage({
        type: MTypeTab.RESPONSE_CONNECT_APP,
        payload: {
          uuid: app.uuid,
          reject: (err as BaseError).message
        }
      }).send();
      return sendResponse({
        reject: (err as BaseError).serialize()
      });
    }
  }
}