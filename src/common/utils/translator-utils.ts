import fs = require('fs');
import path = require('path');
import glob = require('glob');
import Translator from './translator';

export function addTranslations(translator: Translator, dirPath: string) {
    glob.sync(`${dirPath}/*.json`).forEach((filePath) => {
        const translations =
            JSON.parse(fs.readFileSync(filePath, 'utf8'));
        const locale = path.basename(filePath, '.json');
        translator.extend(locale, translations);
    });
}
