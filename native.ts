/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { IpcMainInvokeEvent } from "electron";

export async function makeKlipySearchRequest(_: IpcMainInvokeEvent, url: string) {

    try {
        const res = await fetch(url, {
            method: "GET",
        });

        const data = await res.json();
        return { status: res.status, json: data };
    } catch (e) {
        return { status: -1, data: String(e) };
    }
}
