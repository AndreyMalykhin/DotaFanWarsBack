import fs = require('fs');
import path = require('path');
import glob = require('glob');
import Translator from './translator';

export function addTranslations(translator: Translator, requireContext: any) {
    requireContext.keys().forEach((modulePath: string) => {
        const translations = requireContext(modulePath);
        const locale = path.basename(modulePath, '.json');
        translator.extend(locale, translations);
    });
}
