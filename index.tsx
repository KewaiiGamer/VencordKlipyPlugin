/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import ErrorBoundary from "@components/ErrorBoundary";
import { Devs } from "@utils/constants";
import definePlugin, { OptionType, PluginNative } from "@utils/types";
import { useCallback, useEffect, useRef, useState } from "@webpack/common";

const Native = VencordNative.pluginHelpers.ReplaceGifsKlipy as PluginNative<typeof import("./native")>;

interface SearchBarComponentProps {
    ref?: React.RefObject<any>;
    autoFocus: boolean;
    size: string;
    onChange: (query: string) => void;
    onClear: () => void;
    query: string;
    placeholder: string;
    className?: string;
}

type TSearchBarComponent =
    React.FC<SearchBarComponentProps>;

interface Gif {
    format: number;
    src: string;
    width: number;
    height: number;
    order: number;
    url: string;
}

interface Instance {
    dead?: boolean;
    state: {
        resultType?: string;
    };
    props: {
        favCopy: Gif[],

        favorites: Gif[],
    },
    forceUpdate: () => void;
}
const page = 0;

export const settings = definePluginSettings({
    localeName: {
        description: "Locale",
        type: OptionType.STRING,
        placeholder: "pt"
    },
    gifsPerPage: {
        description: "Gifs per page",
        type: OptionType.NUMBER,
        placeholder: "20"
    },
    apiKey: {
        description: "Klipy API Key",
        type: OptionType.STRING,
        placeholder: "api_key"
    },
    filterLevel: {
        description: "Filtering level",
        type: OptionType.SELECT,
        options: [
            { label: "Off", value: "off", default: true },
            { label: "Low", value: "low" },
            { label: "Medium", value: "medium" },
            { label: "High", value: "high" }
        ]
    },
    customerId: {
        description: "Customer Id",
        type: OptionType.STRING,
        placeholder: "username"
    }
});

async function searchKlipy(searchQuery: string) {

    const gifSearchUrl = `https://api.klipy.com/api/v1/${settings.store.apiKey}/gifs/search?page=${page}&per_page=${settings.store.gifsPerPage}&q=${searchQuery}&customer_id=${settings.store.customerId}&locale=${settings.store.localeName}&content_filter=${settings.store.filterLevel}`;
    // CORS jumpscare
    const { status, json } = await Native.makeKlipySearchRequest(
        gifSearchUrl,
    );
    switch (status) {
        case 200:
            break;
        case -1:
            throw "Failed to connect to Klipy API: " + json;
        case 403:
            throw "Invalid Klipy API key or version";
        default:
            throw new Error(`Failed to search "${searchQuery}")\n${status} ${json}`);
    }


    let order = 0;
    let score = settings.store.gifsPerPage ?? 20;
    const gifs: { score: number, gif: Gif }[] = json.data.data.map((el: any) => {
        const gif: Gif = {
            format: 0,
            src: el.file.hd.gif.url,
            width: el.file.hd.gif.width,
            height: el.file.hd.gif.height,
            order,
            url: el.file.hd.gif.url,
        };
        order += 1;
        score -= 1;
        return { score, gif };
    });

    gifs.sort((a, b) => b.score - a.score);
    return gifs.map(e => e.gif);
}

function SearchBar({ instance, SearchBarComponent }: { instance: Instance; SearchBarComponent: TSearchBarComponent; }) {
    const [query, setQuery] = useState("");
    const ref = useRef<HTMLElement>(null);

    const onChange = useCallback(async (searchQuery: string) => {
        setQuery(searchQuery);
        const { props } = instance;

        // return early
        if (searchQuery === "") {
            props.favorites = props.favCopy;
            instance.forceUpdate();
            return;
        }


        // scroll back to top
        ref.current
            ?.closest("#gif-picker-tab-panel")
            ?.querySelector('[class*="scrollerBase"]')
            ?.scrollTo(0, 0);
        const gifs = await searchKlipy(searchQuery);
        props.favorites = gifs;
        instance.forceUpdate();


    }, [instance.state]);

    useEffect(() => {
        return () => {
            instance.dead = true;
        };
    }, []);

    return (
        <SearchBarComponent
            ref={ref}
            autoFocus={true}
            size="md"
            className=""
            onChange={onChange}
            onClear={() => {
                setQuery("");
                if (instance.props.favCopy != null) {
                    instance.props.favorites = instance.props.favCopy;
                    instance.forceUpdate();
                }
            }}
            query={query}
            placeholder="Search KLIPY"
        />
    );
}


export default definePlugin({
    name: "ReplaceGifsKlipy",
    description: "Replaces the gif Search with Klipy.com",
    authors: [Devs.Kewaii],
    patches: [
        {
            find: "renderHeaderContent()",
            replacement: [
                {
                    // https://regex101.com/r/07gpzP/1
                    // ($1 renderHeaderContent=function { ... switch (x) ... case FAVORITES:return) ($2) ($3 case default: ... return r.jsx(($<searchComp>), {...props}))
                    match: /(renderHeaderContent\(\).{1,150}FAVORITES:return)(.{1,150});(case.{1,200}default:.{0,50}?return\(0,\i\.jsx\)\((?<searchComp>\i\..{1,10}),)/,
                    replace: "$1 this.state.resultType === 'Favorites' ? $self.renderSearchBar(this, $<searchComp>) : $2;$3"
                },
                {
                    // to persist filtered favorites when component re-renders.
                    // when resizing the window the component rerenders and we loose the filtered favorites and have to type in the search bar to get them again
                    match: /(,suggestions:\i,favorites:)(\i),/,
                    replace: "$1$self.getFav($2),favCopy:$2,"
                }

            ]
        }
    ],

    settings,


    instance: null as Instance | null,
    renderSearchBar(instance: Instance, SearchBarComponent: TSearchBarComponent) {
        this.instance = instance;
        return (
            <ErrorBoundary noop>
                <SearchBar instance={instance} SearchBarComponent={SearchBarComponent} />
            </ErrorBoundary>
        );
    },

    getFav(favorites: Gif[]) {
        if (!this.instance || this.instance.dead) return favorites;
        const { favorites: filteredFavorites } = this.instance.props;

        return filteredFavorites != null && filteredFavorites?.length !== favorites.length ? filteredFavorites : favorites;

    }
});
