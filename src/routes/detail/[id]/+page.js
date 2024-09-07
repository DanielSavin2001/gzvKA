export const ssr = true;
export const prerender = false;

export function load({params}) {
    return {
        id: params.id
    };
}