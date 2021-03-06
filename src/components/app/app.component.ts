/// <reference path='../../typings/shp-write.d.ts'/>
/// <reference path='../../typings/tokml.d.ts'/>

import { Observable } from 'rxjs';
import { Component } from '@angular/core';
import { Http } from '@angular/http';
import { MdDialog } from '@angular/material';
import { saveAs } from 'file-saver';
import { download as downloadShp } from 'shp-write';
import tokml = require('tokml');
import JSZip = require('jszip');

import AboutDialogComponent from '../about.dialog/about.dialog.component';
import MapService from '../../services/map.service';
import ConversionService from '../../services/conversion.service';

@Component({
  selector: 'app',
  template: require<any>('./app.component.html'),
  styles: [
    require<any>('./app.component.less')
  ],
  providers: [MapService, ConversionService]
})
export default class AppComponent {
  private isGeocoding: boolean;
  private noResult: boolean;
  private expecteExclude: boolean;
  private results: Array<any>;
  private completeResults: Array<any>;
  private placeName: string;
  private selectedIndex: number;
  private hasMore: boolean;

  constructor(private http: Http, private mapService: MapService, private conversionService: ConversionService, private dialog: MdDialog) {
    this.isGeocoding = false;
    this.noResult = false;
    this.hasMore = false;
    this.results = [];
    this.completeResults = [];
    this.expecteExclude = false;
  }

  ngOnInit() {
    this.mapService.initialize();
  }

  search() {
    if (!this.placeName) {

      this.expecteExclude = false;
      return;
    }

    this.isGeocoding = true;
    this.noResult = false;
    this.selectedIndex = undefined;
    this.mapService.clear();

    let arrStr;
    if (this.expecteExclude) {
      arrStr = '&exclude_place_ids=' + encodeURIComponent(JSON.stringify(this.completeResults.map(poi => poi.place_id)));
    } else {
      arrStr = '';
      this.completeResults = [];
      this.results = [];
    }
    this.expecteExclude = false;

    this.http
        .get(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(this.placeName)}&format=json&limit=10&polygon_geojson=1` + arrStr)
        .map(res => res.json())
        .finally(() => {
          this.isGeocoding = false;
        })
        .subscribe(results => {

          this.completeResults = this.completeResults.concat(results);

          const previousSize = this.results.length;

          this.results = this.completeResults.filter(result => {
            return result.osm_type === 'relation' && result.type === 'administrative';
          });

          this.noResult = (this.results.length - previousSize) <= 0;
          this.hasMore = !this.noResult;
        }, () => {
          this.noResult = true;
          this.hasMore = false;
        });
  }

  more() {
    this.expecteExclude = true;
    this.search();
  }

  clear() {
    this.noResult = false;
    this.hasMore = false;
    this.results = [];
    this.completeResults = [];
    this.placeName = '';
    this.selectedIndex = undefined;
    this.mapService.clear();
  }

  openDetails(placeID) {
    window.open(`http://nominatim.openstreetmap.org/details.php?place_id=${placeID}`);
  }

  openAboutDialog() {
    this.dialog.open(AboutDialogComponent);
  }

  showBoundary(geometry, index) {
    this.selectedIndex = index;
    this.mapService.showBoundary(geometry);
  }

  downloadGeoJSON(result) {
    let geojson = this.conversionService.toFeatureCollection(result);
    let blob = new Blob([JSON.stringify(geojson)], { type: 'application/json' });
    saveAs(blob, 'boundary.geojson');
  }

  downloadKMZ(result) {
    let geojson = this.conversionService.toFeatureCollection(result);
    let kml = tokml(geojson, { name: 'display_name' });

    let zip = new JSZip();
    zip.file('doc.kml', kml);

    Observable.fromPromise(zip.generateAsync({ type: 'blob' }))
      .subscribe((blob) => {
        saveAs(blob, 'boundary.kmz');
      });
  }

  downloadShapefile(result) {
    let geojson = this.conversionService.toFeatureCollection(result);

    downloadShp(geojson, {
      folder: 'boundary',
      types: {
        point: 'Point',
        polygon: 'Polygon',
        line: 'LineString'
      }
    });
  }
}
