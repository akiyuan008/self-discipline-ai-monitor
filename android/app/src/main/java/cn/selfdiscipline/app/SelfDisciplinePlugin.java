package cn.selfdiscipline.app;

import android.app.AppOpsManager;
import android.app.usage.UsageStats;
import android.app.usage.UsageStatsManager;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.os.Process;
import android.provider.Settings;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.List;

@CapacitorPlugin(name = "SelfDiscipline")
public class SelfDisciplinePlugin extends Plugin {

    @PluginMethod
    public void hasUsageAccess(PluginCall call) {
        boolean granted = checkUsageAccess();
        JSObject ret = new JSObject();
        ret.put("granted", granted);
        call.resolve(ret);
    }

    @PluginMethod
    public void openUsageAccessSettings(PluginCall call) {
        Intent intent = new Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(intent);
        call.resolve();
    }

    @PluginMethod
    public void getUsageStats(PluginCall call) {
        Long startTs = call.getLong("startTs");
        Long endTs = call.getLong("endTs");

        if (startTs == null || endTs == null) {
            call.reject("startTs and endTs are required");
            return;
        }

        if (!checkUsageAccess()) {
            call.reject("Usage access not granted");
            return;
        }

        UsageStatsManager usm = (UsageStatsManager) getContext().getSystemService(Context.USAGE_STATS_SERVICE);
        PackageManager pm = getContext().getPackageManager();
        
        List<UsageStats> queryUsageStats = usm.queryUsageStats(UsageStatsManager.INTERVAL_DAILY, startTs, endTs);

        JSArray statsArray = new JSArray();
        if (queryUsageStats != null) {
            for (UsageStats stats : queryUsageStats) {
                if (stats.getTotalTimeInForeground() > 0) {
                    JSObject statObj = new JSObject();
                    String pkg = stats.getPackageName();
                    statObj.put("packageName", pkg);
                    statObj.put("totalMs", stats.getTotalTimeInForeground());
                    
                    try {
                        ApplicationInfo appInfo = pm.getApplicationInfo(pkg, 0);
                        CharSequence label = pm.getApplicationLabel(appInfo);
                        if (label != null) {
                            statObj.put("label", label.toString());
                        }
                    } catch (PackageManager.NameNotFoundException e) {
                        // Ignore
                    }
                    statsArray.put(statObj);
                }
            }
        }

        JSObject ret = new JSObject();
        ret.put("stats", statsArray);
        call.resolve(ret);
    }

    private boolean checkUsageAccess() {
        AppOpsManager appOps = (AppOpsManager) getContext().getSystemService(Context.APP_OPS_SERVICE);
        int mode = appOps.checkOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, 
                Process.myUid(), getContext().getPackageName());
        return mode == AppOpsManager.MODE_ALLOWED;
    }
}
