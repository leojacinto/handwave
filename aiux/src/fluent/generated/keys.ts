import '@servicenow/sdk/global'

declare global {
    namespace Now {
        namespace Internal {
            interface Keys extends KeysRegistry {
                explicit: {
                    'aiux-color-swatch|handwave': {
                        table: 'sys_aix_color_swatch'
                        id: '08750c6e38db06ab6c032d004f00050c'
                    }
                    'aiux-experience-page-rel|x-snc-handwave-home-page': {
                        table: 'sys_aix_experience_page_rel'
                        id: '248c0d324c2e2501bd7b1d853c30975c'
                    }
                    'aiux-experience-page-rel|x-snc-handwave-incidents-page': {
                        table: 'sys_aix_experience_page_rel'
                        id: '7b397443edce3b767f297c0183131bec'
                    }
                    'aiux-experience-prop|appHeadCss': {
                        table: 'sys_aix_experience_properties'
                        id: 'ac9be3f9e4e91867ec5fff3fc66eaece'
                    }
                    'aiux-experience-prop|appTailwindCss': {
                        table: 'sys_aix_experience_properties'
                        id: '45f2b4241fad7e83691c5459c8dc88a0'
                    }
                    'aiux-experience|handwave': {
                        table: 'sys_aix_experience'
                        id: 'c4f640d53efa970997e73f9be6578855'
                    }
                    'aiux-layout-widget|lifecycle': {
                        table: 'sys_aix_widget'
                        id: '7038fd72cfbe6125c7c684038f9f41c5'
                    }
                    'aiux-page-widget|x-snc-handwave-home-page': {
                        table: 'sys_aix_widget'
                        id: '724ef23e659a0fc820298dd14ae7a82d'
                    }
                    'aiux-page-widget|x-snc-handwave-incidents-page': {
                        table: 'sys_aix_widget'
                        id: '4405371572f85e5830b9187e83ad6540'
                    }
                    'aiux-page|x-snc-handwave-home-page': {
                        table: 'sys_aix_page'
                        id: '0f9c135b4559f61cd633340aca410a00'
                    }
                    'aiux-page|x-snc-handwave-incidents-page': {
                        table: 'sys_aix_page'
                        id: '1027f8b334878d579283ff1b79308a33'
                    }
                    'aiux-project|x_snc_handwave': {
                        table: 'sys_aix_project'
                        id: 'abcdaa7b384b3718c382015af96bed46'
                    }
                    'aiux-theme|handwave': {
                        table: 'sys_aix_theme'
                        id: '3eb2892c4a08f561676430b8baeac31d'
                    }
                    'aiux-widget|aiux-hello-world': {
                        table: 'sys_aix_widget'
                        id: '5c64ac03b47c1209ee001819d97e53bb'
                    }
                    bom_json: {
                        table: 'sys_module'
                        id: 'afc30a6cb8fa4248bda529bcedb2ac4b'
                    }
                    'jev-api': {
                        table: 'sys_ws_definition'
                        id: '7ea6f1c68fce4b3f815ecee5932c7530'
                    }
                    'jev-retire-route': {
                        table: 'sys_ws_operation'
                        id: 'd677c35ffcef41ccb32a2dc5ccb787e0'
                    }
                    package_json: {
                        table: 'sys_module'
                        id: '0ca1a1a02f994713bbdcb5ac56855a56'
                    }
                    'typesafe-api-key': {
                        table: 'sys_properties'
                        id: 'b272a55d1661446da2c1947a0d82b6b4'
                    }
                }
                composite: [
                    {
                        table: 'sn_glider_source_artifact'
                        id: '862b463995754bbaa7924817747f9552'
                        key: {
                            name: 'aiux-source abcdaa7b384b3718c382015af96bed46'
                        }
                    },
                    {
                        table: 'sn_glider_source_artifact_m2m'
                        id: 'a678ac93ac59479182582a3d8f07e205'
                        key: {
                            application_file: 'abcdaa7b384b3718c382015af96bed46'
                            source_artifact: '862b463995754bbaa7924817747f9552'
                        }
                    },
                ]
            }
        }
    }
}
