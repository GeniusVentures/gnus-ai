

export function iObjToString(srcObj: any): string {
    return Object.keys(srcObj).reduce((previous, key) => {
        if (!key.match(/^-*\d+$/)) {
            return previous + `\n  ${key}: ${srcObj[key]},`;
        } else {
            return previous;
        }
    }, '{') + '\n}\n';
}
