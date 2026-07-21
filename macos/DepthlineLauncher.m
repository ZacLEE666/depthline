#import <Cocoa/Cocoa.h>

@interface DepthlineAppDelegate : NSObject <NSApplicationDelegate>
@property(nonatomic, strong) NSStatusItem *statusItem;
@property(nonatomic, strong) NSMenuItem *statusMenuItem;
@property(nonatomic, strong) NSMenuItem *restartMenuItem;
@property(nonatomic, strong) NSMenuItem *stopMenuItem;
@property(nonatomic, strong) NSTask *serverTask;
@property(nonatomic, strong) NSFileHandle *logHandle;
@property(nonatomic, strong) NSTimer *healthTimer;
@property(nonatomic) NSInteger healthAttempts;
@property(nonatomic) BOOL openWhenReady;
@property(nonatomic) BOOL stopping;
@property(nonatomic) BOOL externallyManaged;
@end

@implementation DepthlineAppDelegate

- (NSURL *)dashboardURL { return [NSURL URLWithString:@"http://127.0.0.1:5173/"]; }
- (NSURL *)healthURL { return [NSURL URLWithString:@"http://127.0.0.1:5173/api/health"]; }

- (void)applicationDidFinishLaunching:(NSNotification *)notification {
    [NSApp setActivationPolicy:NSApplicationActivationPolicyAccessory];
    [self configureMenuBar];
    [self startServerOpeningDashboard:YES];
}

- (void)applicationWillTerminate:(NSNotification *)notification {
    [self.healthTimer invalidate];
    if (self.serverTask.running) {
        self.stopping = YES;
        [self.serverTask terminate];
    }
}

- (void)configureMenuBar {
    self.statusItem = [[NSStatusBar systemStatusBar] statusItemWithLength:NSVariableStatusItemLength];
    NSImage *image = [NSImage imageWithSystemSymbolName:@"circle.grid.cross" accessibilityDescription:@"Depthline"];
    self.statusItem.button.image = image;
    self.statusItem.button.toolTip = @"Depthline";

    NSMenu *menu = [[NSMenu alloc] init];
    self.statusMenuItem = [[NSMenuItem alloc] initWithTitle:@"状态：正在启动" action:nil keyEquivalent:@""];
    self.statusMenuItem.enabled = NO;
    [menu addItem:self.statusMenuItem];
    [menu addItem:[NSMenuItem separatorItem]];
    [menu addItem:[self item:@"打开 Depthline" action:@selector(openDashboard:) key:@"o"]];
    self.restartMenuItem = [self item:@"重启服务" action:@selector(restartServer:) key:@"r"];
    [menu addItem:self.restartMenuItem];
    self.stopMenuItem = [self item:@"停止服务" action:@selector(stopServer:) key:@"s"];
    [menu addItem:self.stopMenuItem];
    [menu addItem:[NSMenuItem separatorItem]];
    [menu addItem:[self item:@"打开日志" action:@selector(openLog:) key:@"l"]];
    [menu addItem:[NSMenuItem separatorItem]];
    [menu addItem:[self item:@"退出 Depthline" action:@selector(quitApp:) key:@"q"]];
    self.statusItem.menu = menu;
}

- (NSMenuItem *)item:(NSString *)title action:(SEL)action key:(NSString *)key {
    NSMenuItem *item = [[NSMenuItem alloc] initWithTitle:title action:action keyEquivalent:key];
    item.target = self;
    return item;
}

- (void)openDashboard:(id)sender {
    [[NSWorkspace sharedWorkspace] openURL:self.dashboardURL];
}

- (void)restartServer:(id)sender {
    if (self.externallyManaged) {
        [self showAlert:@"Depthline 已由其他进程运行" message:@"请先停止原来的开发服务，再从菜单栏启动 Depthline。"];
        return;
    }
    __weak typeof(self) weakSelf = self;
    [self terminateOwnedServer:^{ [weakSelf startServerOpeningDashboard:NO]; }];
}

- (void)stopServer:(id)sender {
    if (self.externallyManaged) {
        [self showAlert:@"无法停止外部服务" message:@"当前服务不是由这个 Depthline 应用启动的。"];
        return;
    }
    __weak typeof(self) weakSelf = self;
    [self terminateOwnedServer:^{ [weakSelf setStatus:@"状态：已停止" running:NO]; }];
}

- (void)openLog:(id)sender {
    NSURL *url = [self logFileURL];
    if (![[NSFileManager defaultManager] fileExistsAtPath:url.path]) {
        [[NSFileManager defaultManager] createDirectoryAtURL:[url URLByDeletingLastPathComponent]
                                 withIntermediateDirectories:YES attributes:nil error:nil];
        [[NSFileManager defaultManager] createFileAtPath:url.path contents:nil attributes:nil];
    }
    [[NSWorkspace sharedWorkspace] openURL:url];
}

- (void)quitApp:(id)sender {
    __weak typeof(self) weakSelf = self;
    [self terminateOwnedServer:^{ [NSApp terminate:weakSelf]; }];
}

- (void)startServerOpeningDashboard:(BOOL)openDashboard {
    self.openWhenReady = openDashboard;
    self.healthAttempts = 0;
    self.externallyManaged = NO;
    [self setStatus:@"状态：正在启动" running:NO];
    __weak typeof(self) weakSelf = self;
    [self checkHealth:^(BOOL healthy) {
        if (healthy) {
            weakSelf.externallyManaged = YES;
            [weakSelf setStatus:@"状态：运行中（外部服务）" running:YES];
            if (weakSelf.openWhenReady) [weakSelf openDashboard:nil];
        } else {
            [weakSelf launchBundledServer];
        }
    }];
}

- (void)launchBundledServer {
    NSURL *resources = [[NSBundle mainBundle] resourceURL];
    NSURL *nodeURL = [resources URLByAppendingPathComponent:@"node"];
    NSURL *serverURL = [resources URLByAppendingPathComponent:@"dist/server/server/index.js"];
    if (![[NSFileManager defaultManager] isExecutableFileAtPath:nodeURL.path] ||
        ![[NSFileManager defaultManager] fileExistsAtPath:serverURL.path]) {
        [self setStatus:@"状态：应用文件不完整" running:NO];
        [self showAlert:@"Depthline 无法启动" message:@"应用内缺少运行文件，请重新构建 Depthline.app。"];
        return;
    }

    NSError *error = nil;
    if (![self prepareLog:&error]) {
        [self setStatus:@"状态：日志不可用" running:NO];
        [self showAlert:@"Depthline 启动失败" message:error.localizedDescription];
        return;
    }

    NSTask *task = [[NSTask alloc] init];
    task.executableURL = nodeURL;
    task.arguments = @[serverURL.path];
    task.currentDirectoryURL = resources;
    NSMutableDictionary *environment = [[[NSProcessInfo processInfo] environment] mutableCopy];
    environment[@"DEPTHLINE_PORT"] = @"5173";
    environment[@"DEPTHLINE_DATA_DIR"] = [NSHomeDirectory() stringByAppendingPathComponent:@".depthline"];
    environment[@"PATH"] = @"/Applications/ChatGPT.app/Contents/Resources:/Applications/Codex.app/Contents/Resources:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin";
    task.environment = environment;
    task.standardOutput = self.logHandle;
    task.standardError = self.logHandle;
    __weak typeof(self) weakSelf = self;
    task.terminationHandler = ^(NSTask *finished) {
        dispatch_async(dispatch_get_main_queue(), ^{
            [weakSelf.logHandle closeFile];
            weakSelf.logHandle = nil;
            weakSelf.serverTask = nil;
            if (!weakSelf.stopping) {
                [weakSelf setStatus:[NSString stringWithFormat:@"状态：服务异常停止（%d）", finished.terminationStatus] running:NO];
            }
            weakSelf.stopping = NO;
        });
    };

    if (![task launchAndReturnError:&error]) {
        [self setStatus:@"状态：启动失败" running:NO];
        [self appendLog:[NSString stringWithFormat:@"Launcher error: %@\n", error.localizedDescription]];
        [self showAlert:@"Depthline 启动失败" message:@"请从菜单栏打开日志查看原因。"];
        return;
    }
    self.serverTask = task;
    [self setStatus:@"状态：正在连接 Codex" running:NO];
    [self beginHealthChecks];
}

- (void)beginHealthChecks {
    [self.healthTimer invalidate];
    __weak typeof(self) weakSelf = self;
    self.healthTimer = [NSTimer scheduledTimerWithTimeInterval:0.6 repeats:YES block:^(NSTimer *timer) {
        weakSelf.healthAttempts += 1;
        [weakSelf checkHealth:^(BOOL healthy) {
            if (healthy) {
                [timer invalidate];
                [weakSelf setStatus:@"状态：运行中" running:YES];
                if (weakSelf.openWhenReady) {
                    weakSelf.openWhenReady = NO;
                    [weakSelf openDashboard:nil];
                }
            } else if (weakSelf.healthAttempts >= 30) {
                [timer invalidate];
                [weakSelf setStatus:@"状态：启动超时" running:NO];
            }
        }];
    }];
}

- (void)checkHealth:(void (^)(BOOL healthy))completion {
    NSMutableURLRequest *request = [NSMutableURLRequest requestWithURL:self.healthURL];
    request.timeoutInterval = 1.2;
    [[[NSURLSession sharedSession] dataTaskWithRequest:request completionHandler:^(NSData *data, NSURLResponse *response, NSError *error) {
        BOOL healthy = [(NSHTTPURLResponse *)response statusCode] == 200 && data != nil;
        dispatch_async(dispatch_get_main_queue(), ^{ completion(healthy); });
    }] resume];
}

- (void)terminateOwnedServer:(void (^)(void))completion {
    [self.healthTimer invalidate];
    NSTask *task = self.serverTask;
    if (!task || !task.running) {
        self.serverTask = nil;
        completion();
        return;
    }
    self.stopping = YES;
    [self setStatus:@"状态：正在停止" running:NO];
    [task terminate];
    __weak typeof(self) weakSelf = self;
    dispatch_async(dispatch_get_global_queue(QOS_CLASS_UTILITY, 0), ^{
        [task waitUntilExit];
        dispatch_after(dispatch_time(DISPATCH_TIME_NOW, 200 * NSEC_PER_MSEC), dispatch_get_main_queue(), ^{
            weakSelf.serverTask = nil;
            weakSelf.stopping = NO;
            completion();
        });
    });
}

- (void)setStatus:(NSString *)title running:(BOOL)running {
    self.statusMenuItem.title = title;
    self.restartMenuItem.enabled = YES;
    self.stopMenuItem.enabled = running && !self.externallyManaged;
    self.statusItem.button.contentTintColor = running ? NSColor.systemGreenColor : NSColor.secondaryLabelColor;
    self.statusItem.button.toolTip = title;
}

- (NSURL *)logFileURL {
    return [[NSURL fileURLWithPath:NSHomeDirectory()]
        URLByAppendingPathComponent:@"Library/Logs/Depthline/Depthline.log"];
}

- (BOOL)prepareLog:(NSError **)error {
    NSURL *url = [self logFileURL];
    if (![[NSFileManager defaultManager] createDirectoryAtURL:[url URLByDeletingLastPathComponent]
                                  withIntermediateDirectories:YES attributes:nil error:error]) return NO;
    if (![[NSFileManager defaultManager] fileExistsAtPath:url.path]) {
        [[NSFileManager defaultManager] createFileAtPath:url.path contents:nil attributes:nil];
    }
    self.logHandle = [NSFileHandle fileHandleForWritingToURL:url error:error];
    if (!self.logHandle) return NO;
    [self.logHandle seekToEndOfFile];
    [self appendLog:[NSString stringWithFormat:@"\n--- Depthline launcher %@ ---\n", [NSDate date]]];
    return YES;
}

- (void)appendLog:(NSString *)message {
    [self.logHandle writeData:[message dataUsingEncoding:NSUTF8StringEncoding]];
}

- (void)showAlert:(NSString *)title message:(NSString *)message {
    NSAlert *alert = [[NSAlert alloc] init];
    alert.messageText = title;
    alert.informativeText = message;
    alert.alertStyle = NSAlertStyleWarning;
    [alert addButtonWithTitle:@"知道了"];
    [NSApp activateIgnoringOtherApps:YES];
    [alert runModal];
}

@end

int main(int argc, const char *argv[]) {
    @autoreleasepool {
        NSApplication *app = [NSApplication sharedApplication];
        DepthlineAppDelegate *delegate = [[DepthlineAppDelegate alloc] init];
        app.delegate = delegate;
        [app run];
    }
    return 0;
}
