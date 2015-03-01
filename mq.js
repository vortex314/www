var mqttApp = angular.module('mqttApp', []);

mqttCtrl = mqttApp.controller('mqttCtrl', function ($scope) {
    var client;// = new Messaging.Client("pcacer", 80, "mosqOtti");
    $scope.updates = 0;
    $scope.host = "pcacer";
    $scope.port = 80;
    $scope.subscription = "#"
    $scope.log = "";
    $scope.topics = {};
    topics = $scope.topics;
    $scope.connect = function () {
        client = new Messaging.Client($scope.host, $scope.port, "mqtt" + Math.random());
        client.startTrace();
        client.onMessageArrived = $scope.messageArrived;
        client.onMessageDelivered = $scope.messageDelivered;
        client.connect({
            onSuccess: function (object) {
                $scope.log = "Connection succeeded" + object;
                $scope.subscribe();
            },
            onFailure: function (err) {
                $scope.log = 'Connect fail. ErrorCode:' + err.errorCode + ', ErrorMsg: ' + err.errorMessage;
            }
        });
    };
    $scope.getTopic = function (str) {
        if (typeof $scope.topics[str] === "undefined") return { "name" : "NAME", "value" :0};
        else
            return $scope.topics[str];
    };
    $scope.setTopic = function (topic, value) {
    };
    $scope.disconnect = function () {
        client.disconnect();
    }
    $scope.subscribe = function () {
        client.subscribe("#", {
            qos: 2,
            onSuccess: function () {
            },
            onFailure: function () {
                alert("subscribe failed ! ");
            }
        })
    };

    $scope.messageArrived = function (message) {
        $scope.updates++;
        isMessageReceived = true;
        try {
            console.log("messageArrived.", 'topic:', message.destinationName, ' ;content:', message.payloadString);
            $scope.log = message.destinationName + ' : ' + message.payloadString;
            topic = message.destinationName;

            if (topic.lastIndexOf(".META") == (topic.length - 5)) { // is it META data ? 
                topic = topic.substr(0, topic.length - 5);
                if (typeof $scope.topics[topic] === "undefined") {
                    $scope.topics[topic] = {"count": 0};
                }
                $scope.topics[topic].meta = JSON.parse(message.payloadString);
            }
            else { // is it just value update ? 
                if (typeof $scope.topics[topic] === "undefined") {
                    $scope.topics[topic] = {"count": 0};
                }
                if (typeof $scope.topics[topic].count === "undefined") {
                    $scope.topics[topic] = {"count": 0};
                }
                $scope.topics[topic].value = message.payloadString;
                $scope[topic] = message.payloadString;
                $scope.topics[topic].count += 1;
                $scope.topics[topic].name = topic;
            }
            ;
        } catch (err) {
            console.log("Exception : " + err + " : " + err.stack);
        }
        ;
        $scope.$apply();
    };
    $scope.messageDelivered = function (response) {
        console.log("messageDelivered. topic:%s, duplicate:%s, payloadString:%s,qos:%s,retained:%s", response.destinationName, response.duplicate, response.payloadString, response.qos, response.retained);
        isMessageDelivered = true;
        //reponse.invocationContext.onMessageArrived = null;
    };
});

mqttCtrl.directive('lmrGauge', function () {
    return {
        restrict: 'C',
        template: '<div style="width:400; height:300">{{drawChart()}}</div>',
//        templateUrl: 'lmr-gauge.html',
        scope: {
            topicObject: '=topic'
        },
        controller: function ($scope) {
            google.load("visualization", "1.0", {'packages': ["corechart", "gauge"]});

            $scope.intValue = function () {
                if ($scope.topicObject) {
                    var valueFloat = parseFloat($scope.topicObject.value);
                    var valueInt = Math.floor(valueFloat * 10);
                    $scope.data.setValue(0, 1, valueInt);
                    if ($scope.options.min > valueInt) $scope.options.min = valueInt;
                    if ($scope.options.max < valueInt) $scope.options.max = valueInt;
                    $scope.chart.draw($scope.data, $scope.options);
                    return valueInt;
                }
                else
                    return 0;
            };
        },
        link: function (scope, element, attrs) {
            google.load("visualization", "1.0", {'packages': ["corechart", "gauge"]});
            scope.attrs = attrs;
            scope.drawChart = function () {
                if (scope.data) {
                    scope.data.setValue(0, 1, scope.intValue());
                    scope.chart.draw(scope.data, scope.options);
                } else {
                    scope.data = google.visualization.arrayToDataTable([
                        ['Label', 'Value'],
                        [attrs.topic, 50]
                    ]);
                    scope.options = {
                        width: 400, height: 120,
                        minorTicks: 1, max: 190, min: 191
                    };
                    scope.chart = new google.visualization.Gauge(element[0]);
                }

            };
            //          google.setOnLoadCallback(scope.drawChart);

            element.on('load', scope.drawChart);
        }
    }
});


mqttApp.directive('barsChart', function ($parse) {
    //explicitly creating a directive definition variable
    //this may look verbose but is good for clarification purposes
    //in real life you'd want to simply return the object {...}
    return {
        restrict: 'E',
        replace: false,
        scope: {
            name: '@topic'
        },
        link: function (scope, element, attrs) {
            scope.table = [
                ['Count', 'Temp'],
            ];
            scope.count = 1;
            scope.data = google.visualization.arrayToDataTable(scope.table);
            scope.options = {
                title: scope.name,
                legend: {position: 'bottom'}
            };

            scope.chart = new google.visualization.LineChart(element[0]);

            scope.chart.draw(scope.data, scope.options);
            scope.change = function (value) {
                scope.count++;
                scope.table.push([scope.count, parseFloat(value)]);
//                scope.table[1]=[1,parseFloat(value)];
                scope.data = google.visualization.arrayToDataTable(scope.table);
                scope.chart.draw(scope.data, scope.options);
            };
            scope.$watch(
                function (scope) {
                    return scope.$parent.getTopic(scope.name).value;
                },
                function (newValue, oldValue) {
                    console.log("CHANGE!");
                    scope.change(newValue);
                },
                true);
        }
    };
})


mqttCtrl.directive('deltaTime', function () {
    return {
        restrict: 'C',
        template: '<p class="bg-primary">{{topicObject.name}}</p><h3 class="bg-primary">{{strTime()}}</h3>',
        scope: {
            name: '@topic'
        },
        controller: function ($scope) {

            $scope.strTime = function () {
                if ($scope.topicObject) {
                    var totalSec = $scope.topicObject.value / 1000;
                    var days = parseInt(totalSec / (3600 * 24));
                    var hours = parseInt(totalSec / 3600) % 24;
                    var minutes = parseInt(totalSec / 60) % 60;
                    var seconds = Math.floor(totalSec % 60);

                    var result = days + " days " + (hours < 10 ? "0" + hours : hours) + ":" + (minutes < 10 ? "0" + minutes : minutes) + ":" + (seconds < 10 ? "0" + seconds : seconds + "");
                    return result;
                }
                else
                    return "hh:mm:ss"
            }
        },
        link: function (scope, element, attrs) {
            scope.change = function (newValue) {
                scope.topicObject = scope.$parent.getTopic(scope.name);
            };
            scope.$watch(
                function (scope) {
                    return scope.$parent.getTopic(scope.name).value;
                },
                function (newValue, oldValue) {
                    scope.change(newValue);
                },
                true);
        }
    }
});


mqttCtrl.directive('absTime', function () {
    return {
        restrict: 'C',
        template: '<p class="bg-primary">{{name}}</p><h3 class="bg-primary">{{result}}</h3>',
        scope: {
            name: '@topic'
        },
        controller: function ($scope) {
        },
        link: function (scope, element, attrs) {
            scope.change = function (newValue) {
                scope.topicObject = scope.$parent.getTopic(scope.name);
                var date = new Date(parseInt(scope.topicObject.value));
                scope.result = "" + date.toISOString();
            };
            scope.$watch(
                function (scope) {
                    return scope.$parent.getTopic(scope.name).value;
                },
                function (newValue, oldValue) {
                    scope.change(newValue);
                },
                true);
        }
    }
});

