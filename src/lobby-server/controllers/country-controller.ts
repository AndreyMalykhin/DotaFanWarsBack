import Bottle = require('bottlejs');
import express = require('express');
import HttpStatus = require('http-status-codes');
import CountryService from '../../common/models/country-service';
import ApiResponse from '../../common/utils/api-response';

export default function factory(diContainer: Bottle.IContainer) {
    const controller = express.Router();
    const countryService: CountryService = (<any> diContainer).countryService;
    controller.get('/', function(req, res, next) {
        countryService.getAll().sort('name').exec()
            .then((countries) => {
                res.json(<ApiResponse> {
                    status: HttpStatus.OK,
                    data: countries.map((country) => {
                        const {id, name, flagUrl} = country;
                        return {
                            id: id,
                            name: name,
                            flagUrl: flagUrl
                        };
                    })
                });
            }, next);
    });
    return controller;
}
