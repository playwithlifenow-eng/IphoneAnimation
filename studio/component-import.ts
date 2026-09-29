import { build, type Plugin } from "esbuild";
import { createRequire } from "node:module";
import { resolve } from "node:path";
const require = createRequire(import.meta.url);

export function parseComponentUrl(input: string) {
  const match = input.trim().match(/https:\/\/(?:www\.)?framer.com\/m\/[^\s"'<>;]+/);
  if (!match) throw new Error("Paste the component’s Copy Import code or its https://framer.com/m/… URL.");
  const url = new URL(match[0]);
  if (!/\.js(?:@[^/]+)?$/.test(url.pathname)) throw new Error("Use a component JavaScript URL from Copy Import, rather than a page or project link.");
  return url.href;
}

function allowedUrl(input: string) {
  const url = new URL(input);
  const host = url.hostname;
  if (url.protocol !== "https:" || url.username || url.password || url.port || !["framer.com", "framerusercontent.com", "esm.sh", "cdn.jsdelivr.net", "ga.jspm.io"].some(h => host === h || host.endsWith("." + h))) throw new Error(`Unsupported component dependency host: ${host}`);
  return url;
}

export async function bundleComponent(sourceUrl: string, fetcher: typeof fetch = fetch) {
  let bytes = 0, modules = 0;
  const cache = new Map<string, Promise<string>>();
  const fetchModule = (input: string) => {
    if (cache.has(input)) return cache.get(input)!;
    const result = (async () => {
      if (++modules > 150) throw new Error("This component exceeds the 150-module import limit.");
      let url = allowedUrl(input);
      for (let i = 0; i < 6; i++) {
        const r = await fetcher(url, { redirect: "manual", signal: AbortSignal.timeout(20000) });
        if (r.status >= 300 && r.status < 400 && r.headers.get("location")) { url = allowedUrl(new URL(r.headers.get("location")!, url).href); continue; }
        if (!r.ok) throw new Error(`Could not download ${url.hostname}${url.pathname} (${r.status}).`);
        if (!r.body) throw new Error("Empty component response.");
        const parts: Uint8Array[] = [];
        for await (const part of r.body as any) { bytes += part.length; if (bytes > 20 * 1024 * 1024) throw new Error("Component dependencies exceed 20 MB."); parts.push(part); }
        return Buffer.concat(parts).toString("utf8").replaceAll("import.meta.url", JSON.stringify(url.href));
      }
      throw new Error("Too many component redirects.");
    })();
    cache.set(input, result); return result;
  };
  const plugin: Plugin = {
    name: "framer-adapter",
    setup(b) {
      // React 18 hosts do not expose React 19's resource-hint helpers. Keep the
      // adapter's hints functional without changing the editor's React runtime.
      b.onResolve({ filter: /^react-dom$/ }, () => ({ path: "react-dom-hints", namespace: "compat" }));
      b.onResolve({ filter: /.*/, namespace: "compat" }, args => ({ path: args.path }));
      b.onLoad({ filter: /.*/, namespace: "compat" }, () => ({ loader: "js", contents: `
        export * from ${JSON.stringify(require.resolve("react-dom"))};
        import DOM from ${JSON.stringify(require.resolve("react-dom"))}; export default DOM;
        const hints = new Set();
        function hint(rel, href, options={}) { if(typeof href!=='string'||hints.has(rel+href))return; hints.add(rel+href); const link=document.createElement('link');link.rel=rel;link.href=href;if(options.crossOrigin!==undefined)link.crossOrigin=options.crossOrigin;document.head.append(link); }
        export const prefetchDNS=(href)=>hint('dns-prefetch',href);
        export const preconnect=(href,options)=>hint('preconnect',href,options);
      ` }));
      b.onResolve({ filter: /^(https?:\/\/|framer$|framer-motion$|react(?:-dom)?(?:\/|$))/ }, args => {
        const name = args.path;
        if (name === "framer" || name === "framer-motion") return { path: require.resolve("unframer") };
        if (/^react(?:-dom)?(?:\/|$)/.test(name)) return { path: require.resolve(name) };
        if (/^https:\/\/esm.sh\/(?:v\d+\/)?(?:react|react-dom)(?:@|\/|\?)/.test(name)) {
          const match = new URL(name).pathname.match(/\/(react-dom|react)(?:@[^/]+)?(?:\/(client|jsx-runtime|jsx-dev-runtime))?/);
          if (match) return { path: require.resolve(match[1] + (match[2] ? "/" + match[2] : "")) };
        }
        return { path: allowedUrl(name).href, namespace: "remote" };
      });
      b.onResolve({ filter: /.*/, namespace: "remote" }, args => {
        if (/^[./]/.test(args.path)) return { path: allowedUrl(new URL(args.path, args.importer).href).href, namespace: "remote" };
        if (!/^(@[\w.-]+\/)?[\w.-]+(?:\/[^\s]+)?$/.test(args.path)) throw new Error("Unsupported module import: " + args.path);
        return { path: "https://esm.sh/" + args.path, namespace: "remote" };
      });
      b.onLoad({ filter: /.*/, namespace: "remote" }, async args => ({ contents: await fetchModule(args.path), loader: "jsx" }));
    },
  };
  const source = `import React from 'react';
import { createRoot } from 'react-dom/client';
import Component from ${JSON.stringify(sourceUrl)};
import { UnframerProvider, FramerStyles } from 'unframer';
const root=createRoot(document.getElementById('root'));
const send=(type,data={})=>parent.postMessage({studioComponent:true,type,...data},'*');
class Boundary extends React.Component { state={error:''}; componentDidMount(){if(!this.state.error)send('ready',{controls})} static getDerivedStateFromError(e){return {error:String(e.message||e)}} componentDidCatch(e){send('error',{message:String(e.message||e)})} render(){return this.state.error?React.createElement('p',{role:'alert'},this.state.error):this.props.children} }
const controls={}; for(const [key,c] of Object.entries(Component.propertyControls||{})){ controls[key]={title:String(c.title||key),type:String(c.type||''),options:Array.isArray(c.options)?c.options.filter(x=>typeof x==='string'):undefined,defaultValue:['string','number','boolean'].includes(typeof c.defaultValue)?c.defaultValue:undefined}; }
let props={}; const defaults=Component.defaultProps||{};
function render(){root.render(React.createElement(Boundary,{key:JSON.stringify(props)},React.createElement(UnframerProvider,null,React.createElement(FramerStyles),React.createElement(Component,{...defaults,...props,style:{width:'100%',height:'100%',...props.style}}))));}
addEventListener('message',e=>{if(e.source===parent&&e.data?.type==='studio-props'){props=e.data.props||{};render();}});
addEventListener('error',e=>send('error',{message:e.message}));addEventListener('unhandledrejection',e=>send('error',{message:String(e.reason)}));
render();`;
  const result = await build({ stdin: { contents: source, resolveDir: resolve("."), sourcefile: "component-entry.jsx", loader: "jsx" }, write: false, bundle: true, format: "iife", platform: "browser", target: "es2022", minify: true, define: { "process.env.NODE_ENV": '"production"' }, plugins: [plugin], logLevel: "silent" });
  return result.outputFiles[0].contents;
}
