module.exports = (() => {
    let config = JSON.parse(files.read("config/config.json"));
    let local_language = context.resources.configuration.locale.language + "-" + context.resources.configuration.locale.country;
    let default_language = language();

    /**
     * 获取app版本号
     * @param {string} package_name app包名
     * @returns {string} app包名不存在，返回null
     */
    function getAppVersion(package_name) {
        let app_infos = context.getPackageManager().getInstalledPackages(0).toArray();
        for (let i = 0; i < app_infos.length; i++) {
            if (app_infos[i].packageName == package_name) {
                return app_infos[i].versionName;
            }
        }
        return null;
    }

    /**
     * 检查是否支持该版本的app，仅支持 \d+(\.\d+)? 的格式
     * @param {string} current_version
     * @param {string} min_supported_version
     * @param {string} max_supported_version
     * @returns {boolean} 支持返回true
     */
    function supportedApplicationVersion(current_version, min_supported_version, max_supported_version) {
        let min_supported_version_arr = min_supported_version.match(/\d+/g);
        let current_version_arr = current_version.match(/\d+/g);
        let max_supported_version_arr = max_supported_version.match(/\d+/g);
        for (let i = 0; i < min_supported_version_arr.length || i < current_version_arr.length; i++) {
            let min = i < min_supported_version_arr.length ? parseInt(min_supported_version_arr[i]) : 0;
            let middle = i < current_version_arr.length ? parseInt(current_version_arr[i]) : 0;
            if (min < middle) {
                break;
            } else if (min > middle) {
                return false;
            }
        }
        for (let i = 0; i < current_version_arr.length || i < max_supported_version_arr.length; i++) {
            let middle = i < current_version_arr.length ? parseInt(current_version_arr[i]) : 0;
            let max = i < max_supported_version_arr.length ? parseInt(max_supported_version_arr[i]) : 0;
            if (middle < max) {
                break;
            } else if (middle > max) {
                return false;
            }
        }
        return true;
    }

    function language() {
        return JSON.parse(files.read("config/languages/" + (config["supported_languages"].match(local_language) != null ? local_language : "zh-CN") + ".json"));
    }

    function weChatIds() {
        let we_chat_version = getAppVersion(config["we_chat_package_name"]);
        for (let i = 0; i < config["supported_versions"].length; i++) {
            let supported_versions = config["supported_versions"][i].split("~");
            if (supportedApplicationVersion(we_chat_version, supported_versions[0], supported_versions[1])) {
                return JSON.parse(files.read("config/text_id/" + config["supported_versions"][i] + ".json"));
            }
        }
    }

    /**
     * 检验语言
     * @returns {boolean}
     */
    function checkSupportedLanguage() {
        return config["supported_languages"].match(local_language) != null;
    }

    /**
     * 校验已安装微信
     * @returns {boolean}
     */
    function checkInstalledWeChat() {
        let installed_we_chat = getAppName(config["we_chat_package_name"]) != null;
        if (!installed_we_chat) {
            dialogs.build({
                content: default_language["uninstalled_we_chat_alert_dialog_message"],
                positive: default_language["confirm"],
                positiveColor: "#008274",
                cancelable: false
            }).show();
        }
        return installed_we_chat;
    }

    /**
     * 校验支持微信版本
     * @returns {boolean}
     */
    function checkSupportedWeChatVersion() {
        let we_chat_version = getAppVersion(config["we_chat_package_name"]);
        let min_supported_version = config["min_supported_version"];
        let max_supported_version = config["max_supported_version"];
        let supported = supportedApplicationVersion(we_chat_version, min_supported_version, max_supported_version);
        if (!supported) {
            dialogs.build({
                content: default_language["unsupported_we_chat_version_alert_dialog_message"].replace("%min_supported_version", min_supported_version).replace("%max_supported_version", max_supported_version).replace("%we_chat_version", we_chat_version),
                positive: default_language["confirm"],
                positiveColor: "#008274",
                cancelable: false
            }).show();
        }
        return supported;
    }

    /**
     * 校验文件
     * @returns {boolean}
     */
    function checkFile() {
        let we_chat_version = getAppVersion(config["we_chat_package_name"]);
        let exists = true, file_name;
        for (let i = 0; i < config["supported_versions"].length; i++) {
            let supported_versions = config["supported_versions"][i].split("~");
            if (supportedApplicationVersion(we_chat_version, supported_versions[0], supported_versions[1])) {
                if (!files.exists("config/text_id/" + config["supported_versions"][i] + ".json")) {
                    exists = false;
                    file_name = config["supported_versions"][i];
                }
                break;
            }
        }
        if (!exists) {
            dialogs.build({
                content: default_language["file_lost_alert_dialog_message"].replace("%file_path", "config/text_id/" + file_name + ".json"),
                positive: default_language["confirm"],
                negativeColor: "#008274",
                cancelable: false
            }).show();
        }
        return exists;
    }
    
    /**
     * 校验已开启无障碍服务
     * @returns {boolean}
     */
    function checkService() {
        let enabled = auto.service != null;
        if (!enabled) {
            dialogs.build({
                content: default_language["jump_to_settings_alert_dialog_message"],
                positive: default_language["confirm"],
                positiveColor: "#008274",
                negative: default_language["cancel"],
                negativeColor: "#008274",
                cancelable: false
            }).on("positive", () => {
                app.startActivity({
                    action: "android.settings.ACCESSIBILITY_SETTINGS"
                });
            }).show();
        }
        return enabled;
    }

    /**
     * 停止已在运行的脚本，确保单脚本运行
     */
    function stopScript() {
        let scripts = engines.all();
        for (let i = 0; i < scripts.length; i++) {
            if (/.+CleanUpWeChatZombieFans\/(main|(activity|modules).+)\.js/.test(scripts[i].getSource().toString())) {
                scripts[i].forceStop();
            }
        }
    }

    return {
        language: language,
        weChatIds: weChatIds,
        getAppVersion: getAppVersion,
        supportedApplicationVersion: supportedApplicationVersion,
        checkSupportedLanguage: checkSupportedLanguage,
        checkInstalledWeChat: checkInstalledWeChat,
        checkSupportedWeChatVersion: checkSupportedWeChatVersion,
        checkFile: checkFile,
        checkService: checkService,
        stopScript: stopScript
    };
})();