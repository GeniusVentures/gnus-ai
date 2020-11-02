const ComPayChannel = artifacts.require('ComPayChannel');
const GNUSToken = artifacts.require('GNUSToken');

contract('PayChannel tests', async accounts => {
    let payChannel;    
    let payId;    
    let eGNUSToken;
    const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
    const OWNERS = [accounts[2], accounts[3]];
    const OPERATOR = accounts[4];

    before(async () => {
        eGNUSToken = await GNUSToken.new();
        payChannel = await ComPayChannel.new(eGNUSToken.address);        
    });


    it('should proposeNewOperator successfully even when paused', async () => {
        const tx = await instance.proposeNewOperator(walletId, accounts[5], { from: accounts[2] });
        const { event, args } = tx.logs[0];

        assert.equal(event, 'ProposeNewOperator');
        assert.equal(args.walletId, walletId);
        assert.equal(args.newOperator, accounts[5]);
        assert.equal(args.proposer, accounts[2]);
    });

    it('should drain tokens successfully when paused', async () => {
        const tx1 = await instance.drainToken(ZERO_ADDRESS, accounts[0], 100);
        assert.equal(tx1.logs[0].event, 'DrainToken');
        assert.equal(tx1.logs[0].args.tokenAddress, ZERO_ADDRESS);
        assert.equal(tx1.logs[0].args.receiver, accounts[0]);
        assert.equal(tx1.logs[0].args.amount.toString(), '100');

        const tx2 = await instance.drainToken(eRC20Token.address, accounts[1], 200);
        assert.equal(tx2.logs[0].event, 'DrainToken');
        assert.equal(tx2.logs[0].args.tokenAddress, eRC20Token.address);
        assert.equal(tx2.logs[0].args.receiver, accounts[1]);
        assert.equal(tx2.logs[0].args.amount.toString(), '200');
    });

        const tx = await instance.renouncePauser();
        const { event, args } = tx.logs[0];
        const isPauser = await instance.isPauser(accounts[0]);

        assert.equal(event, 'PauserRemoved');
        assert.equal(args.account, accounts[0]);
        assert.equal(isPauser, false);
    });
});
