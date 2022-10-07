import { Worker, NEAR, NearAccount } from "near-workspaces";
import anyTest, { TestFn } from "ava";

const EVENT_METADATA = {
    eventId: "nearpass",
    title: "NearPass",
    eventMetadataUrl: "someurl",
    eventStart: "1665977063000000000",
    hostName: "Nikhil",
    tiersInformation: [
        { price: 1, thumbnail: "thumbnail_url", ticketsRemaining: 10 },
    ],
};

const EVENT_RESULT = {
    title: "NearPass",
    timestamp: "1665977063000000000",
    eventId: "nearpass",
    tiers: [{ price: 1, thumbnail: "thumbnail_url", ticketsRemaining: 10 }],
    host: { name: "Nikhil", accountId: "ali.test.near" },
    active: true,
};

const test = anyTest as TestFn<{
    worker: Worker;
    accounts: Record<string, NearAccount>;
}>;

test.beforeEach(async (t) => {
    const worker = await Worker.init();

    const root = worker.rootAccount;
    const events = await root.createSubAccount("events");
    const nft = await root.createSubAccount("nft");
    const ali = await root.createSubAccount("ali");
    const bob = await root.createSubAccount("bob");

    await events.deploy(process.argv[2]);
    await nft.deploy(process.argv[3]);

    await events.call(events, "init", { nft_contract_id: nft.accountId });
    await nft.call(nft, "init", { owner_id: events.accountId });

    t.context.worker = worker;
    t.context.accounts = { root, events, nft, ali, bob };
});

test.afterEach(async (t) => {
    // Stop Sandbox server
    await t.context.worker.tearDown().catch((error) => {
        console.log("Failed to stop the Sandbox:", error);
    });
});

test("User can create events", async (t) => {
    const { events, ali, bob } = t.context.accounts;
    await ali.call(events, "createEvent", EVENT_METADATA, {
        attachedDeposit: NEAR.parse("1"),
    });
    let result = await events.view("getEvent", { eventId: "nearpass" });
    t.deepEqual(result, EVENT_RESULT);
});

test("Not able to create duplicate event", async (t) => {
    const { events, ali } = t.context.accounts;
    await ali.call(events, "createEvent", EVENT_METADATA, {
        attachedDeposit: NEAR.parse("1"),
    });
    await t.throwsAsync(
        ali.call(events, "createEvent", EVENT_METADATA, {
            attachedDeposit: NEAR.parse("1"),
        })
    );
});

test("User should be able to buy tickets", async (t) => {
    const { events, nft, ali, bob } = t.context.accounts;
    await ali.call(events, "createEvent", EVENT_METADATA, {
        attachedDeposit: NEAR.parse("1"),
    });
    await bob.call(
        events,
        "buyTicket",
        { eventId: "nearpass" },
        { attachedDeposit: NEAR.parse("1") }
    );

    let result = await nft.view("nft_supply_for_owner", {
        accountId: bob.accountId,
    });
    t.is(result, 1);
});
