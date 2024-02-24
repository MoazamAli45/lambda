g.globals.app.controller(
  "CloudLogInController",
  function ($scope, $controller, $http) {
    $http.defaults.xsrfCookieName = "csrftoken";
    $http.defaults.xsrfHeaderName = "X-CSRFToken";

    $scope.credentials = { identifier: "", secret: "" };
    $scope.isProcessingLogIn = false;

    $scope.logIn = function () {
      NProgress.start();
      if ($scope.isProcessingLogIn) {
        return;
      }
      $scope.isProcessingLogIn = true;
      $http.post("/api/sessions", $scope.credentials, "json").then(
        function (r) {
          var redirectTo = g.utils.getQueryParam("redirect_to");
          if (redirectTo) {
            window.location.href = g.utils.getQueryParam("redirect_to");
          } else {
            window.location.href = "/instances";
          }
        },
        function (r) {
          $scope.isProcessingLogIn = false;
          NProgress.done();
          if (r.status == 429) {
            alert("Exceeded maximum log in failures. Try again in one hour.");
          } else {
            alert("Bad credentials");
          }
        }
      );
    };
  }
);
