g.globals.app.controller(
  "CloudEntranceController",
  function ($scope, $controller, $http) {
    $http.defaults.xsrfCookieName = "csrftoken";
    $http.defaults.xsrfHeaderName = "X-CSRFToken";

    // $location service in angular is broken, full stop,
    // so we go lower down the stack to window.location.
    var params = new URLSearchParams(window.location.search);
    var paramsEmail = params.get("email");
    $scope.isEmailReadOnly = !!paramsEmail;

    $scope.fieldErrors = {
      tax_type: "Required",
      first_name: "Required",
      last_name: "Required",
      email: "Enter a valid email",
      password: "Must be at least 10 characters",
      has_accepted_tos: "You must agree to the above to proceed",
      phone_number: "Enter a valid phone number",
      organization: "Enter a valid organization",
    };

    $scope.normalizeAccountObject = function (account) {
      let normalizedAccount = { ...account };
      if (!normalizedAccount.organization) {
        normalizedAccount.organization = null;
      }
      if (!normalizedAccount.phone_number) {
        normalizedAccount.phone_number = null;
      }
      if (!normalizedAccount.tax_type) {
        normalizedAccount.tax_type = null;
      }
      return normalizedAccount;
    };

    $scope.init = function () {
      $scope.isProcessingSignUp = false;
      $scope.isSignUpButtonEnabled = true;
      $scope.account = {
        email: paramsEmail || "",
        password: "",
        first_name: "",
        last_name: "",
        organization: "",
        has_accepted_tos: false,
        phone_number: "",
        token: params.get("token"),
        tax_type: "",
      };
      $scope.errors = {
        email: null,
        password: null,
        first_name: null,
        last_name: null,
        organization: null,
        has_accepted_tos: null,
        phone_number: null,
      };
    };

    $scope.populateHubspotSignupForm = function () {
      return {
        fields: [
          {
            objectTypeId: "0-1",
            name: "email",
            value: $scope.account.email,
          },
          {
            objectTypeId: "0-1",
            name: "firstname",
            value: $scope.account.first_name,
          },
          {
            objectTypeId: "0-1",
            name: "lastname",
            value: $scope.account.last_name,
          },
          {
            objectTypeId: "0-1",
            name: "company",
            value: $scope.account.organization || "Unknown",
          },
          {
            objectTypeId: "0-1",
            name: "account_type",
            value: $scope.account.tax_type,
          },
          {
            objectTypeId: "0-1",
            name: "job_role",
            value: "Other",
          },
          {
            objectTypeId: "0-1",
            name: "form_name",
            value: "GPU Cloud OD - Free Account",
          },
          {
            objectTypeId: "0-1",
            name: "last_offer_source",
            value: "Non-HV",
          },
          {
            objectTypeId: "0-1",
            name: "utm_source",
            value: "form",
          },
          {
            objectTypeId: "0-1",
            name: "utm_medium",
            value: "internal",
          },
          {
            objectTypeId: "0-1",
            name: "utm_campaign",
            value: "2023-form-gpu-cloud-od",
          },
          {
            objectTypeId: "0-1",
            name: "lead_source",
            value: "Other",
          },
          {
            objectTypeId: "0-1",
            name: "lastquoteproductlines__c",
            value: "cloud-on-demand",
          },
        ],
      };
    };

    $scope.signUp = function () {
      runProgressBar();
      if (!$scope.isSignUpButtonEnabled) {
        return;
      }
      $scope.isSignUpButtonEnabled = false;

      $http
        .post(
          "/api/accounts",
          $scope.normalizeAccountObject($scope.account),
          "json"
        )
        .then(
          function (llSignupSuccessResponse) {
            let hsform = $scope.populateHubspotSignupForm();
            hsform["context"] = {
              hutk: window.Cookies.get("hubspotutk"),
              pageUri: window.location.href,
            };

            $http
              .post(
                "https://api.hsforms.com/submissions/v3/integration/submit/21998649/febbe41d-2491-4684-bb38-c58005b313d3",
                angular.toJson(hsform),
                "json"
              )
              .then(function (hsSignupSuccessResponse) {
                g.conversions.registerForCloud();
                logIn({
                  identifier: $scope.account.email,
                  secret: $scope.account.password,
                });
              })
              .catch(function (hsSignupFailureResponse) {
                Rollbar.error(
                  "[HUBSPOT] Error posting HS sign-up form for email",
                  {
                    emailAffected: $scope.account.email,
                    responseData: hsSignupFailureResponse.data,
                  }
                );

                // post to GA and log in anyway, even if HS post failed -- a HS error should not be blocking
                g.conversions.registerForCloud();
                logIn({
                  identifier: $scope.account.email,
                  secret: $scope.account.password,
                });
              });
          },
          function (llSignupFailureResponse) {
            $scope.isSignUpButtonEnabled = true;
            stopProgressBar();

            $scope.errors = {};
            const fieldErrors = llSignupFailureResponse.data.field_errors;
            if (fieldErrors) {
              for (let field in fieldErrors) {
                const code = fieldErrors[field].code;
                if (
                  code === "sign-up/email-already-taken" ||
                  code === "teams/email_already_registered"
                ) {
                  $scope.errors[field] = "This address is already registered";
                } else {
                  $scope.errors[field] = $scope.fieldErrors[field];
                }
              }
            }

            Rollbar.info("[ACC] Account API post failed", {
              emailAffected: $scope.account.email,
              errors: $scope.errors,
            });
          }
        );
    };

    $scope.setFirstNameErrors = function () {
      if (!$scope.account.first_name) {
        return;
      }
      let errors = $scope.fieldErrors.first_name;
      if ($scope.account.first_name.length >= 1) {
        errors = null;
      }
      $scope.errors.first_name = errors;
    };

    $scope.setLastNameErrors = function () {
      if (!$scope.account.last_name) {
        return;
      }
      let errors = $scope.fieldErrors.last_name;
      if ($scope.account.last_name.length >= 1) {
        errors = null;
      }
      $scope.errors.last_name = errors;
    };

    $scope.setEmailErrors = function () {
      if (!$scope.account.email) {
        return;
      }
      let errors = $scope.fieldErrors.email;
      if ($scope.account.email && g.utils.isEmailValid($scope.account.email)) {
        errors = null;
      }
      $scope.errors.email = errors;
    };

    $scope.setPasswordErrors = function () {
      if (!$scope.account.password) {
        return;
      }
      let errors = $scope.fieldErrors.password;
      if ($scope.account.password.length >= 10) {
        errors = null;
      }
      $scope.errors.password = errors;
    };

    function logIn(credentials) {
      runProgressBar();
      $http.post("/api/sessions", credentials, "json").then(
        function (r) {
          if ($scope.account.token) {
            window.location.href = "/team";
          } else {
            window.location.href = "/sign-up/email-unverified";
          }
        },
        function (r) {
          alert("Bad credentials");
        }
      );
    }

    function runProgressBar() {
      if (!$scope.isProcessingSignUp) {
        $scope.isProcessingSignUp = true;
        NProgress.start();
      }
    }

    function stopProgressBar() {
      if ($scope.isProcessingSignUp) {
        NProgress.done();
        $scope.isProcessingSignUp = false;
      }
    }
  }
);
