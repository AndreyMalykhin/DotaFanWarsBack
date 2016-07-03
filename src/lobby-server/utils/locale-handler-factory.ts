import express = require('express');
import Bottle = require('bottlejs');
import Translator from '../../common/utils/translator';

export default function factory(diContainer: Bottle.IContainer) {
    return (
        req: express.Request,
        res: express.Response,
        next: express.NextFunction
    ) => {
        const locale: string = <any> req.acceptsLanguages(['en', 'ru']);

        if (locale) {
            const translator: Translator = (<any> diContainer).translator;
            translator.locale(locale);
        }

        next();
    };
}
