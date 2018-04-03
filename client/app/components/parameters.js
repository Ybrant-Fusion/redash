import { find } from 'underscore';
import moment from 'moment';

import template from './parameters.html';
import queryBasedParameterTemplate from './query-based-parameter.html';
import parameterSettingsTemplate from './parameter-settings.html';


const ParameterSettingsComponent = {
  template: parameterSettingsTemplate,
  bindings: {
    resolve: '<',
    close: '&',
    dismiss: '&',
  },
  controller($sce, Query) {
    'ngInject';

    this.trustAsHtml = html => $sce.trustAsHtml(html);
    this.parameter = this.resolve.parameter;

    if (this.parameter.queryId) {
      Query.get({ id: this.parameter.queryId }, (query) => {
        this.queries = [query];
      });
    }

    this.searchQueries = (term) => {
      if (!term || term.length < 3) {
        return;
      }

      Query.search({ q: term }, (results) => {
        this.queries = results;
      });
    };
  },
};

function optionsFromQueryResult(queryResult) {
  const columns = queryResult.data.columns;
  const numColumns = columns.length;
  let options = [];
  // If there are multiple columns, check if there is a column
  // named 'name' and column named 'value'. If name column is present
  // in results, use name from name column. Similar for value column.
  // Default: Use first string column for name and value.
  if (numColumns > 0) {
    let nameColumn = null;
    let valueColumn = null;
    columns.forEach((column) => {
      const columnName = column.name.toLowerCase();
      if (columnName === 'name') {
        nameColumn = column.name;
      }
      if (columnName === 'value') {
        valueColumn = column.name;
      }
      // Assign first string column as name and value column.
      if (nameColumn === null) {
        nameColumn = column.name;
      }
      if (valueColumn === null) {
        valueColumn = column.name;
      }
    });
    if (nameColumn !== null && valueColumn !== null) {
      options = queryResult.data.rows.map((row) => {
        const queryResultOption = {
          name: row[nameColumn],
          value: row[valueColumn],
        };
        return queryResultOption;
      });
    }
  }
  return options;
}

function updateCurrentValue(param, options) {
  const found = find(options, option => option.value === param.value) !== undefined;

  if (!found) {
    param.value = options[0].value;
  }
}

const QueryBasedParameterComponent = {
  template: queryBasedParameterTemplate,
  bindings: {
    param: '<',
    queryId: '<',
  },
  controller(Query) {
    'ngInject';

    this.$onChanges = (changes) => {
      if (changes.queryId) {
        Query.resultById({ id: this.queryId }, (result) => {
          const queryResult = result.query_result;
          this.queryResultOptions = optionsFromQueryResult(queryResult);
          updateCurrentValue(this.param, this.queryResultOptions);
        });
      }
    };
  },
};

function ParametersDirective($location, $uibModal) {
  function getChangeIndex(n, o) {
    for (let i = 0; i < n.length; i += 1) {
      if (n[i] !== o[i]) {
        return i;
      }
    }
    return [];
  }
  return {
    restrict: 'E',
    transclude: true,
    scope: {
      parameters: '=',
      syncValues: '=?',
      editable: '=?',
      changed: '&onChange',
    },
    template,
    link(scope) {
      scope.getPairedToInputIndex = (param) => {
        let index;
        if (param.type === 'enum' && param.name.endsWith('$From')) {
          scope.parameters.forEach((searchParam, i) => {
            if (searchParam.type === 'enum' && searchParam.name.split('$')[0] === param.name.split('$')[0]
              && searchParam.name.split('$')[1] === 'To') {
              index = i;
            }
          });
        }
        return index;
      };
      scope.getPairedFromInputIndex = (param) => {
        let index;
        if (param.name.endsWith('$To')) {
          scope.parameters.forEach((searchParam, i) => {
            if (searchParam.type === 'enum' && searchParam.name.split('$')[0] === param.name.split('$')[0]
              && searchParam.name.split('$')[1] === 'From') {
              index = i;
            }
          });
        }
        return index;
      };
      // is this the correct location for this logic?
      if (scope.syncValues !== false) {
        scope.enumValue = Array(scope.parameters.length);
        scope.$watch('parameters', () => {
          if (scope.changed) {
            scope.changed({});
          }
          scope.parameters.forEach((param, index) => {
            if (param.value !== null || param.value !== '') {
              $location.search(`p_${param.name}`, param.value);
              if (param.type === 'enum') {
                if (param.title.endsWith('$To') || param.title.endsWith('$From')) {
                  if (typeof param.value === 'object' || !param.value.startsWith('$')) {
                    scope.enumValue[index] = '$Custom_date';
                    if (param.title.endsWith('$To')) {
                      param.ngModel = param.ngModel || moment(param.value).endOf('day').toDate();
                      param.value = moment(param.value).endOf('day').format('YYYY-MM-DD HH:mm');
                    } else {
                      param.ngModel = param.ngModel || moment(param.value).startOf('day').toDate();
                      param.value = moment(param.value).startOf('day').format('YYYY-MM-DD HH:mm');
                    }
                  } else {
                    scope.enumValue[index] = param.value;
                  }
                } else {
                  scope.enumValue[index] = param.value;
                }
              }
            }
          });
        }, true);
        scope.$watch('enumValue', (n, o) => {
          if (scope.changed) {
            const changedIndex = getChangeIndex(n, o);
            if (n[changedIndex]) {
              if (!scope.parameters[changedIndex].name.endsWith('$To') && !scope.parameters[changedIndex].name.endsWith('$From')) {
                scope.parameters[changedIndex].value = n[changedIndex];
              } else if (n[changedIndex] === '$Custom_date') {
                scope.parameters[changedIndex].value = moment().startOf('day').format('YYYY-MM-DD HH:mm');
                scope.parameters[scope.getPairedToInputIndex(scope.parameters[changedIndex])].value = moment().endOf('day').format('YYYY-MM-DD HH:mm');
              } else if (n[changedIndex] === '$Yesterday' && scope.parameters[changedIndex].name.endsWith('$From')) {
                scope.parameters[changedIndex].value = '$Yesterday';
                scope.parameters[scope.getPairedToInputIndex(scope.parameters[changedIndex])].value = '$Today';
              } else if (n[changedIndex] === '$Today' && scope.parameters[changedIndex].name.endsWith('$From')) {
                scope.parameters[changedIndex].value = '$Today';
                scope.parameters[scope.getPairedToInputIndex(scope.parameters[changedIndex])].value = '$Tomorrow';
              } else if (n[changedIndex] === '$Last_week' && scope.parameters[changedIndex].name.endsWith('$From')) {
                scope.parameters[changedIndex].value = '$Last_week';
                scope.parameters[scope.getPairedToInputIndex(scope.parameters[changedIndex])].value = '$Tomorrow';
              } else {
                scope.parameters[changedIndex].value = n[changedIndex];
              }
            }
            scope.changed({});
          }
        }, true);
      }

      // These are input as newline delimited values,
      // so we split them here.
      scope.extractEnumOptions = (enumOptions) => {
        if (enumOptions) {
          return enumOptions.split('\n');
        }
        return [];
      };
      scope.mapOptions = (option) => {
        if (option) {
          if (option.startsWith('$')) {
            return option.slice(1).replace('_', ' ');
          }
          return option;
        }
      };
      scope.hideEnumToDate = (index) => {
        if (scope.parameters[index].type === 'enum' && scope.parameters[index].name.endsWith('$To') &&
          scope.enumValue[scope.getPairedFromInputIndex(scope.parameters[index])] !== '$Custom_date') {
          return true;
        }
        return false;
      };
      scope.hideToInput = name => name.endsWith('$To');
      scope.showParameterSettings = (param) => {
        $uibModal.open({
          component: 'parameterSettings',
          resolve: {
            parameter: param,
          },
        });
      };
      scope.clearParam = (param, index) => {
        if (param.name.endsWith('$To')) {
          scope.enumValue[index] = '$Today';
        } else {
          scope.enumValue[index] = '$Yesterday';
          const pairedIndex = scope.getPairedToInputIndex(param);
          scope.enumValue[pairedIndex] = '$Today';
        }
      };
    },
  };
}

export default function init(ngModule) {
  ngModule.directive('parameters', ParametersDirective);
  ngModule.component('queryBasedParameter', QueryBasedParameterComponent);
  ngModule.component('parameterSettings', ParameterSettingsComponent);
}
