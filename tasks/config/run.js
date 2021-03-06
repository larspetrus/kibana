import { esTestConfig } from '../../src/test_utils/es';
import { kibanaTestServerUrlParts } from '../../test/kibana_test_server_url_parts';
import { resolve } from 'path';

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const PKG_VERSION = require('../../package.json').version;

module.exports = function (grunt) {

  function createKbnServerTask({ runBuild, flags = [] }) {
    return {
      options: {
        wait: false,
        ready: /Server running/,
        quiet: false,
        failOnError: false
      },
      cmd: runBuild
        ? `./build/${runBuild}/bin/kibana`
        : process.execPath,
      args: [
        ...runBuild ? [] : [require.resolve('../../scripts/kibana'), '--oss'],

        '--env.name=development',
        '--logging.json=false',

        ...flags,

        // allow the user to override/inject flags by defining cli args starting with `--kbnServer.`
        ...grunt.option.flags().reduce(function (flags, flag) {
          if (flag.startsWith('--kbnServer.')) {
            flags.push(`--${flag.slice(12)}`);
          }

          return flags;
        }, [])
      ]
    };
  }

  const apiTestServerFlags = [
    '--optimize.enabled=false',
    '--elasticsearch.url=' + esTestConfig.getUrl(),
    '--elasticsearch.healthCheck.delay=' + HOUR,
    '--server.port=' + kibanaTestServerUrlParts.port,
    '--server.xsrf.disableProtection=true',
  ];

  const funcTestServerFlags = [
    '--server.maxPayloadBytes=1648576', //default is 1048576
    '--elasticsearch.url=' + esTestConfig.getUrl(),
    '--server.port=' + kibanaTestServerUrlParts.port,
  ];

  const browserTestServerFlags = [
    '--plugins.initialize=false',
    '--optimize.bundleFilter=tests',
    '--server.port=5610',
  ];

  return {
    // used by the test and jenkins:unit tasks
    //    runs the eslint script to check for linting errors
    eslint: {
      cmd: process.execPath,
      args: [
        require.resolve('../../scripts/eslint'),
        '--no-cache'
      ]
    },

    // used by the test:api task
    //    runs the kibana server prepared for the api_integration tests
    apiTestServer: createKbnServerTask({
      flags: [
        ...apiTestServerFlags
      ]
    }),

    // used by the test:api:server task
    //    runs the kibana server in --dev mode, prepared for developing api_integration tests
    //    and watching for changes so the server will restart when necessary
    devApiTestServer: createKbnServerTask({
      flags: [
        '--dev',
        '--no-base-path',
        ...apiTestServerFlags,
      ]
    }),

    // used by test:ui task
    //    runs the kibana server prepared for the functional tests
    funcTestServer: createKbnServerTask({
      flags: [
        ...funcTestServerFlags,
      ]
    }),

    // used by the test:ui:server task
    //    runs the kibana server in dev mode, prepared for the functional tests
    devFuncTestServer: createKbnServerTask({
      flags: [
        ...funcTestServerFlags,
        '--dev',
        '--dev_mode.enabled=false',
        '--no-base-path',
        '--optimize.watchPort=5611',
        '--optimize.watchPrebuild=true',
        '--optimize.bundleDir=' + resolve(__dirname, '../../optimize/testUiServer'),
      ]
    }),

    // used by test:uiRelease task
    //    runs the kibana server from the oss distributable prepared for the functional tests
    ossDistFuncTestServer: createKbnServerTask({
      runBuild: `oss/kibana-${PKG_VERSION}-${process.platform}-x86_64`,
      flags: [
        ...funcTestServerFlags,
      ]
    }),

    // used by the test:browser task
    //    runs the kibana server to serve the browser test bundle
    browserTestServer: createKbnServerTask({
      flags: [
        ...browserTestServerFlags,
      ]
    }),

    // used by the test:coverage task
    //    runs the kibana server to serve the intrumented version of the browser test bundle
    browserTestCoverageServer: createKbnServerTask({
      flags: [
        ...browserTestServerFlags,
        '--tests_bundle.instrument=true',
      ]
    }),

    // used by the test:dev task
    //    runs the kibana server to serve the browser test bundle, but listens for changes
    //    to the public/browser code and rebuilds the test bundle on changes
    devBrowserTestServer: createKbnServerTask({
      flags: [
        ...browserTestServerFlags,
        '--dev',
        '--no-watch',
        '--no-base-path',
        '--optimize.watchPort=5611',
        '--optimize.watchPrebuild=true',
        '--optimize.bundleDir=' + resolve(__dirname, '../../optimize/testdev'),
      ]
    }),

    testEsServer: {
      options: {
        wait: false,
        ready: /started/,
        quiet: false,
      },
      cmd: process.execPath,
      args: [
        'scripts/es',
        grunt.option('from') || 'snapshot',
        '--license', 'oss',
        '-E', `http.port=${esTestConfig.getPort()}`,
        '-E', `discovery.zen.ping.unicast.hosts=localhost:${esTestConfig.getPort()}`,
      ],
    },

    verifyNotice: {
      options: {
        wait: true,
      },
      cmd: process.execPath,
      args: [
        'scripts/notice',
        '--validate'
      ]
    }
  };
};
