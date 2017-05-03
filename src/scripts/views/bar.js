var $ = require('jquery')
var _ = require('underscore')
var BaseChart = require('./basechart')
var numberFormatter = require('../util/number-formatter')

module.exports = BaseChart.extend({
  settings: {
    graphs: [
      {
        type: 'column',
        title: 'Data',
        valueField: 'value',
        fillAlphas: 0.6,
        clustered: false,
        lineColor: '#97bbcd',
        balloonText: '<b>[[category]]</b><br>Total: [[value]]'
      },
      {
        type: 'column',
        title: 'Filtered Data',
        valueField: 'filteredValue',
        fillAlphas: 0.4,
        clustered: false,
        lineColor: '#97bbcd',
        balloonFunction: function (item, graph) {
          var baloonHtml = '<b>' + item.category +
            '</b><br>Total: ' + (+item.dataContext.value).toLocaleString() +
            '<br>Filtered Amount: ' + (+item.dataContext.filteredValue).toLocaleString()
          try{
            var percentOfTotal = (parseFloat(item.dataContext.filteredValue)/parseFloat(item.dataContext.value)*100).toFixed(2)
            if(percentOfTotal != "NaN"){ // NaN becomes "NaN" when converted to Fixed
              baloonHtml += ' (' + percentOfTotal + '%)'  
            }
          } catch(err){
            console.log(err)
          }
          return baloonHtml
        }
      }
    ],
    chart: {
      type: 'serial',
      theme: 'light',
      responsive: {
        enabled: true,
        rules: [
          {
            maxWidth: 600,
            overrides: {
              maxSelectedSeries: 5
            }
          },
          {
            maxWidth: 450,
            overrides: {
              maxSelectedSeries: 3,
              chartCursor: {
                enabled: false
              }
            }
          }
        ]
      },
      addClassNames: true,
      categoryField: 'label',
      marginLeft: 0,
      marginRight: 0,
      marginTop: 0,
      valueAxes: [{
        labelFunction: numberFormatter,
        position: 'right',
        inside: true,
        axisThickness: 0,
        axisAlpha: 0,
        tickLength: 0,
        includeAllValues: true,
        ignoreAxisWidth: true,
        gridAlpha: 0
      }],
      chartCursor: {
        fullWidth: true,
        cursorAlpha: 0.1,
        zoomable: false,
        oneBalloonOnly: true,
        categoryBalloonEnabled: false
      },
      maxSelectedSeries: 10,
      // startDuration: 0.5,
      // startEffect: 'easeOutSine',
      zoomOutText: '',
      creditsPosition: 'top-right',
      categoryAxis: {
        autoWrap: true,
        gridAlpha: 0,
        labelFunction: function (label) {
          return label && label.length > 12 ? label.substr(0, 12) + '…' : label
        },
        guides: [{
          lineThickness: 2,
          lineColor: '#ddd64b',
          fillColor: '#ddd64b',
          fillAlpha: 0.4,
          // label: 'Filtered',
          // inside: true,
          // color: '#000',
          balloonText: 'Currently filtered',
          expand: true,
          above: true
        }]
      }
    }
  },
  initialize: function (options) {
    BaseChart.prototype.initialize.apply(this, arguments)

    _.bindAll(this, 'onClickCursor', 'onClickBar', 'onClickLabel', 'onHover', 'onClickScroll', 'zoomToBeginning')
  },
  events: {
    'click .scroll a': 'onClickScroll',
    'click .toggle-base-collection-link': 'onClickToggleBaseCollectionLink',
    'click .zoom-to-filtered-collection-link': 'onClickZoomToFilteredCollectionLink'
  },
  render: function () {
    BaseChart.prototype.render.apply(this, arguments)

    // If there are greater than 10 bars, zoom to the first bar (ideally this would be done by configuration)
    this.chart.addListener('drawn', this.zoomToBeginning)
    this.zoomToBeginning() // since rendered isn't called the first time

    // Listen to cursor hover changes
    this.chart.chartCursor.addListener('changed', this.onHover)

    // Listen to label clicks
    this.chart.categoryAxis.addListener('clickItem', this.onClickLabel)

    // If chart cursor is enabled (on larger screens) listen to clicks on it
    if (this.chart.chartCursor.enabled) {
      this.delegateEvents(_.extend({'click .card-content': 'onClickCursor'}, this.events))
    // Otherwise listen to clicks on the bars
    } else {
      this.chart.addListener('clickGraphItem', this.onClickBar)
    }

    // If there are more records than the default, show scroll bars
    if (this.chart.endIndex - this.chart.startIndex < this.collection.length) {
      this.$('.scroll').removeClass('hidden')
    }

    // If there are filters, show the toggle for base collection and zoom filter collection buttons
    if(_.isEmpty(this.filteredCollection.getFilters())){
      this.$('.toggle-base-collection').hide()
      this.$('.zoom-to-filtered-collection').hide()
    } else {
      this.$('.toggle-base-collection').show()
      this.$('.zoom-to-filtered-collection').show()
    }
  },
  zoomToBeginning: function () {
    if (this.collection.length > this.chart.maxSelectedSeries) {
      this.chart.zoomToIndexes(0, this.chart.maxSelectedSeries)
    }
  },
  onClickScroll: function (e) {
    var modification = $(e.currentTarget).data('dir') === 'decrease' ? -1 : 1
    var displayCount = this.chart.maxSelectedSeries
    var start = Math.min(this.collection.length - 1 - displayCount, Math.max(0, this.chart.startIndex + modification))
    var end = Math.max(displayCount, Math.min(this.collection.length - 1, this.chart.endIndex + modification))

    if (start !== this.chart.startIndex || end !== this.chart.endIndex) {
      this.chart.zoomToIndexes(start, end)
    }
    e.preventDefault()
  },
  // Keep track of which column the cursor is hovered over
  onHover: function (e) {
    if (e.index == null) {
      this.hovering = null
    } else {
      this.hovering = this.chart.categoryAxis.data[e.index]
    }
  },
  // When the user clicks on a bar in this chart
  onClickCursor: function (e) {
    if (this.hovering !== null) {
      this.onSelect(this.hovering.category)
    }
  },
  onClickBar: function (e) {
    this.onSelect(e.item.category)
  },
  onClickLabel: function (e) {
    this.onSelect(e.serialDataItem.category)
  },
  onSelect: function (category) {
    // If already selected, clear the filter
    var filter = this.filteredCollection.getFilters(this.filteredCollection.getTriggerField())
    if (filter && filter.expression.value === category) {
      this.vent.trigger(this.collection.getDataset() + '.filter', {
        field: this.filteredCollection.getTriggerField()
      })
    // Otherwise, add the filter
    } else {
      // Trigger the global event handler with this filter
      this.vent.trigger(this.collection.getDataset() + '.filter', {
        field: this.collection.getTriggerField(),
        expression: {
          type: '=',
          value: category
        }
      })
    }
  },
  onClickToggleBaseCollectionLink: function (e) {
    var target = $(e.target)
    // If target was the text, change target to the icon
    if(!target.hasClass('toggle-base-collection-icon')){
      target = target.children('.toggle-base-collection-icon')
    }
    // If the toggle is currently on, hide the first graph (base collection)
    if(target.hasClass("fa-toggle-on")){
      this.chart.hideGraph(this.chart.graphs[0])
    } else { 
      this.chart.showGraph(this.chart.graphs[0])
    }
    // No matter what, toggle the icons classes to show the other one
    target.filter('span.fa').toggleClass("fa-toggle-on")
    target.filter('span.fa').toggleClass("fa-toggle-off")
    e.preventDefault()
  }, 
  onClickZoomToFilteredCollectionLink: function (e) {
    var target = $(e.target)
    // If target was the text, change target to the icon
    if(!target.hasClass('zoom-to-filtered-collection-icon')){
      target = target.children('.zoom-to-filtered-collection-icon')
    }

    // If the toggle is currently on, hide the first graph (base collection)
    if(target.hasClass("fa-search-plus")){ // zoom in
      var filteredCollectionValues = _.map(this.filteredCollection.models, function(o){return parseInt(o.attributes.value)})
      var filteredCollectionMaxValue = _.max(filteredCollectionValues) * 1.15 // include some top padding
      this.chart.valueAxes[0].maximum = filteredCollectionMaxValue 
      this.chart.validateNow()
    } else { // zoom out
      var collectionValues = _.map(this.collection.models, function(o){return parseInt(o.attributes.value)})
      var collectionMaxValue = _.max(collectionValues) * 1.15 // include some top padding
      this.chart.valueAxes[0].maximum = collectionMaxValue 
      this.chart.validateNow()
    }

    // No matter what, toggle the icons classes to show the other one
    target.filter('span.fa').toggleClass("fa-search-plus")
    target.filter('span.fa').toggleClass("fa-search-minus")
    e.preventDefault()
  }



})
