import Polyglot = require('node-polyglot');

export default class Translator {
    private polyglots: {[locale: string]: Polyglot} = {};
    private currentPolyglot: Polyglot;

    constructor() {
        this.currentPolyglot = this.getPolyglot('en');
    }

    locale(id: string) {
        this.currentPolyglot = this.getPolyglot(id);
        this.currentPolyglot.locale(id);
    }

    extend(localeId: string, translations: Object) {
        this.getPolyglot(localeId).extend(translations);
    }

    t(msg: string, options?: Polyglot.InterpolationOptions) {
        return this.currentPolyglot.t(msg, options);
    }

    private getPolyglot(localeId: string) {
        let polyglot = this.polyglots[localeId];

        if (!polyglot) {
            polyglot = new Polyglot({locale: localeId});
            this.polyglots[localeId] = polyglot;
        }

        return polyglot;
    }
}
