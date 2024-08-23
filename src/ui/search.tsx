import { OramaClient } from "@oramacloud/client";
import { createEffect, createSignal, Show, For, Suspense, startTransition, onCleanup, createMemo } from "solid-js";
import { Dialog } from "@kobalte/core/dialog";
import { A, createAsync, useNavigate, usePreloadRoute } from "@solidjs/router";
import { createList } from "solid-list";
import { createMarker, makeSearchRegex } from "@solid-primitives/marker";

const client = new OramaClient({
	endpoint: import.meta.env.VITE_ORAMA_ENDPOINT,
	api_key: import.meta.env.VITE_ORAMA_API_KEY,
});

type OramaResult = {
  hits: {
    document: OramaDocument;
  }[];
}

type OramaDocument = {
  content: string;
  path: string;
  section: string;
  title: string;
}

export function Search() {
	const navigate = useNavigate();
	const preload = usePreloadRoute();
	const [open, setOpen] = createSignal(false);
	const [searchTerm, setSearchTerm] = createSignal("");

	const result = createAsync(async () => {
		const _searchTerm = searchTerm();
		if (!_searchTerm) return {};
		const result: OramaResult | null  = await client.search({
			term: _searchTerm,
			mode: "fulltext",
		});
		if (!result) return {};
		const groupedHits = result.hits.reduce((groupedHits, hit) => {
			const section = hit.document.section.replace(/(^|-)([a-z])/g, (_, sep, letter) => sep + letter.toUpperCase());
			if (!groupedHits[section]) {
				groupedHits[section] = [];
			}
			groupedHits[section].push(hit);
			return groupedHits;
		}, {} as Record<string, OramaResult["hits"]>);
		setActive(0);
		return groupedHits;
	}, { initialValue: {} });

	const resultArray = () =>  Object.values(result()).flatMap(hits => hits);

	const { active, setActive, onKeyDown } = createList({
		items: () =>
			[
				...Array(
					Object.values(result()).flatMap(hits => hits).length,
				).keys(),
			],
		initialActive: 0,
		handleTab: false,
	});

	createEffect(() => {
		const _active = active();
		if (_active === null) return;
		const path = resultArray()[_active]?.document.path;
		if (!path) return;
		preload(new URL(path, "https://docs.solidjs.com"), { preloadData: true });
	});

	createEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.metaKey && e.key === "k") {
				e.preventDefault();
				setOpen((open) => !open);
			}
		};

		window.addEventListener("keydown", handleKeyDown);
		onCleanup(() => {
			window.removeEventListener("keydown", handleKeyDown);
		});
	});

	const regex = createMemo(() => makeSearchRegex(searchTerm()));
	const highlightTitle = createMarker(text => <mark class="font-bold bg-transparent dark:text-white">{text()}</mark>);
	const highlightContent = createMarker(text => <mark class="rounded bg-blue-200 dark:bg-slate-600 dark:text-white px-0.5">{text()}</mark>);

	return (
		<Dialog open={open()} onOpenChange={(open) => {
			if (!open) {
				setSearchTerm("");
			}
			setOpen(open);
		}}>
			<Dialog.Trigger class="items-center rounded-lg border border-black/10 dark:border-white/60 dark:bg-slate-800 px-2 py-1.5 flex">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					fill="currentColor"
					viewBox="0 0 256 256"
					class="size-4"
				>
					<path d="M229.66,218.34l-50.07-50.06a88.11,88.11,0,1,0-11.31,11.31l50.06,50.07a8,8,0,0,0,11.32-11.32ZM40,112a72,72,0,1,1,72,72A72.08,72.08,0,0,1,40,112Z" />
				</svg>
				<span class="ml-1 text-sm">Search</span>
				<kbd class="ml-2 min-w-6 rounded border border-black/5 px-1 pb-px pt-1 text-center font-mono text-xs dark:bg-slate-700">
					<span>⌘</span>
					<span class="ml-0.5">K</span>
				</kbd>
			</Dialog.Trigger>
			<Dialog.Portal>
				<Dialog.Overlay class="fixed inset-0 z-50 bg-black/50" />
				<Dialog.Content class="fixed inset-0 lg:top-14 z-50 lg:bottom-auto w-full lg:left-1/2 lg:max-w-[550px] lg:-translate-x-1/2 overflow-hidden lg:rounded-2xl border border-black/5 bg-white pt-4 dark:border-white/60 dark:bg-slate-800">
					<div class="flex h-full flex-col">
						<div class="flex mr-4 lg:mx-4 items-center">
							<Dialog.CloseButton
								tabIndex={-1}
								class="px-4 lg:hidden py-3"
							>
								<svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 256 256" class="size-5"><path d="M168.49,199.51a12,12,0,0,1-17,17l-80-80a12,12,0,0,1,0-17l80-80a12,12,0,0,1,17,17L97,128Z" /></svg>
							</Dialog.CloseButton>
							<div class="relative grow">
								<svg
									xmlns="http://www.w3.org/2000/svg"
									fill="currentColor"
									viewBox="0 0 256 256"
									class="absolute inset-y-0 my-auto ml-3 left-0 size-5"
								>
									<path d="M229.66,218.34l-50.07-50.06a88.11,88.11,0,1,0-11.31,11.31l50.06,50.07a8,8,0,0,0,11.32-11.32ZM40,112a72,72,0,1,1,72,72A72.08,72.08,0,0,1,40,112Z" />
								</svg>

								<input
									placeholder="Search docs"
									aria-label="Search docs"
									spellcheck={false}
									value={searchTerm()}
									class="px-9 w-full rounded border border-blue-100 bg-white dark:bg-slate-800 py-2 ring-2 ring-blue-400 focus-visible:border focus-visible:border-blue-400 focus-visible:ring-2 focus:outline-none"
									onInput={(e) =>
										startTransition(() => 
											setSearchTerm((e.target as HTMLInputElement).value)
										)
									}
									onFocus={() => setActive(0)}
									onBlur={() => setActive(null)}
									onKeyDown={(e) => {
										if (e.key === "Enter") {
											navigate(resultArray()[active()!].document.path);
											setOpen(false);
											setSearchTerm("");
											return;
										}
										onKeyDown(e);
									}}
								/>
								<Show when={searchTerm()}>
									<button
										class="absolute inset-y-0 right-0 p-2"
										onClick={() => setSearchTerm("")}
									>
										<svg
											xmlns="http://www.w3.org/2000/svg"
											fill="currentColor"
											viewBox="0 0 256 256"
											class="size-4"
										>
											<path d="M208.49,191.51a12,12,0,0,1-17,17L128,145,64.49,208.49a12,12,0,0,1-17-17L111,128,47.51,64.49a12,12,0,0,1,17-17L128,111l63.51-63.52a12,12,0,0,1,17,17L145,128Z" />
										</svg>
									</button>
								</Show>
							</div>
						</div>
						<div class="mt-1 grow space-y-2 overflow-y-auto px-4 pt-2 scrollbar-thin">
							<Suspense>
								<Show
									when={
										searchTerm() &&
                    Object.keys(result()).length === 0
									}
								>
									<p class="mt-2 text-center text-sm">
            No results for "<span class="font-bold">{searchTerm()}</span>"
									</p>
									<p class="!mb-3 !mt-4 text-center text-sm">
            Believe this query should return results?{" "}
										<A
											href={`https://github.com/solidjs/solid-docs-next/issues/new?title=[Search]+Missing+results+for+query+%22${searchTerm()}%22`}
											target="_blank"
											class="text-blue-400 font-bold"
										>
              Let us know
										</A>
            .
									</p>
								</Show>
								<For each={Object.entries(result())}>
									{([section, hits]) => (
										<div>
											<p class="pl-2 pt-2 text-sm text-black/70 dark:text-white/70">{section}</p>
											<For each={hits}>
												{(hit) => {
													const itemIndex = Object.values(result())
														.flatMap((items) => items)
														.findIndex((i) => i === hit);

													return (
														<Dialog.CloseButton
															as={A}
															href={hit.document.path}
															classList={{"pl-4 rounded-md block p-2 text-sm": true, 
																"bg-blue-100 dark:bg-slate-700": itemIndex === active(),
															}}
															onMouseMove={() => setActive(itemIndex)}
														>
															<span class="block">{highlightTitle(hit.document.title, regex())}</span>
															<span
																class="block text-black/70 dark:text-white/70 truncate"
															>{highlightContent(hit.document.content, regex())}</span>
														</Dialog.CloseButton>
													);}
												}
											</For>
										</div>
									)}
								</For>
								<div class="items-center border-t border-black/10 dark:border-slate-700 pt-2 pb-3 text-sm hidden lg:block">
									<KeyboardShortcut key="↩" />
									<span class="ml-1">to select</span>
									<KeyboardShortcut key="↑/↓" class="ml-3" />
									<span class="ml-1">to navigate</span>
									<KeyboardShortcut key="esc" class="ml-3" />
									<span class="ml-1">to close</span>
								</div>
							</Suspense>
						</div>
					</div>
				</Dialog.Content>
			</Dialog.Portal>
		</Dialog>
	);
}

function KeyboardShortcut(props: { key: string; class?: string }) {
	return (
		<kbd
			classList={{
				"min-w-6 rounded border border-black/10 bg-slate-100 dark:bg-slate-700 dark:border-slate-700 px-1 pb-px pt-1 text-center font-mono text-xs": true,
				[props.class ?? ""]: true
			}}
		>
			{props.key}
		</kbd>
	);
}


